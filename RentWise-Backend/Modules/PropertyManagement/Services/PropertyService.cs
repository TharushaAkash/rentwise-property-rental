using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using RentWise.API.Data;
using RentWise.API.Modules.PropertyManagement.Entities;
using RentWise.API.Modules.PropertyManagement.Interfaces;

namespace RentWise.API.Modules.PropertyManagement.Services
{
    public class PropertyService : IPropertyService
    {
        private readonly ApplicationDbContext _context;
        private static bool _columnsChecked = false;
        private static readonly SemaphoreSlim _semaphore = new SemaphoreSlim(1, 1);

        public PropertyService(ApplicationDbContext context)
        {
            _context = context;
        }

        private async Task EnsureColumnsExistAsync()
        {
            if (_columnsChecked) return;
            await _semaphore.WaitAsync();
            try
            {
                if (_columnsChecked) return;

                // 1. Create Properties table if it doesn't exist
                await _context.Database.ExecuteSqlRawAsync(@"
                    CREATE TABLE IF NOT EXISTS ""Properties"" (
                        ""Id"" uuid NOT NULL,
                        ""OwnerId"" uuid NOT NULL,
                        ""Title"" text NOT NULL DEFAULT '',
                        ""Description"" text NOT NULL DEFAULT '',
                        ""Address"" text NOT NULL DEFAULT '',
                        ""MonthlyRent"" numeric NOT NULL DEFAULT 0,
                        ""Bedrooms"" integer NOT NULL DEFAULT 0,
                        ""Bathrooms"" integer NOT NULL DEFAULT 0,
                        ""Facilities"" text NOT NULL DEFAULT '',
                        ""Sqft"" integer NOT NULL DEFAULT 0,
                        ""PropertyType"" text NOT NULL DEFAULT 'House',
                        ""FeatureTags"" text[] NOT NULL DEFAULT '{}',
                        ""PhotoCount"" integer NOT NULL DEFAULT 0,
                        ""Status"" integer NOT NULL DEFAULT 0,
                        ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        ""UpdatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        CONSTRAINT ""PK_Properties"" PRIMARY KEY (""Id"")
                    );

                    -- Foreign key to Users
                    DO $$
                    BEGIN
                      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Users' AND table_schema = 'public') THEN
                        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_Properties_Users_OwnerId') THEN
                          ALTER TABLE ""Properties"" ADD CONSTRAINT ""FK_Properties_Users_OwnerId"" 
                          FOREIGN KEY (""OwnerId"") REFERENCES ""Users"" (""Id"") ON DELETE RESTRICT;
                        END IF;
                      END IF;
                    END $$;

                    -- Ensure columns exist if table was created previously
                    ALTER TABLE IF EXISTS ""Properties"" ADD COLUMN IF NOT EXISTS ""Sqft"" integer NOT NULL DEFAULT 0;
                    ALTER TABLE IF EXISTS ""Properties"" ADD COLUMN IF NOT EXISTS ""PropertyType"" text NOT NULL DEFAULT 'House';
                    ALTER TABLE IF EXISTS ""Properties"" ADD COLUMN IF NOT EXISTS ""FeatureTags"" text[] NOT NULL DEFAULT '{}';
                    ALTER TABLE IF EXISTS ""Properties"" ADD COLUMN IF NOT EXISTS ""PhotoCount"" integer NOT NULL DEFAULT 0;

                    -- 2. Create PropertyPhotos table
                    CREATE TABLE IF NOT EXISTS ""PropertyPhotos"" (
                        ""Id"" uuid NOT NULL,
                        ""PropertyId"" uuid NOT NULL,
                        ""PhotoUrl"" text NOT NULL DEFAULT '',
                        ""IsPrimary"" boolean NOT NULL DEFAULT false,
                        ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        ""UpdatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        CONSTRAINT ""PK_PropertyPhotos"" PRIMARY KEY (""Id"")
                    );

                    DO $$
                    BEGIN
                      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_PropertyPhotos_Properties_PropertyId') THEN
                        ALTER TABLE ""PropertyPhotos"" ADD CONSTRAINT ""FK_PropertyPhotos_Properties_PropertyId"" 
                        FOREIGN KEY (""PropertyId"") REFERENCES ""Properties"" (""Id"") ON DELETE CASCADE;
                      END IF;
                    END $$;

                    -- 3. Create PropertyDocuments table
                    CREATE TABLE IF NOT EXISTS ""PropertyDocuments"" (
                        ""Id"" uuid NOT NULL,
                        ""PropertyId"" uuid NOT NULL,
                        ""DocumentType"" text NOT NULL DEFAULT '',
                        ""DocumentUrl"" text NOT NULL DEFAULT '',
                        ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        ""UpdatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        CONSTRAINT ""PK_PropertyDocuments"" PRIMARY KEY (""Id"")
                    );

                    DO $$
                    BEGIN
                      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_PropertyDocuments_Properties_PropertyId') THEN
                        ALTER TABLE ""PropertyDocuments"" ADD CONSTRAINT ""FK_PropertyDocuments_Properties_PropertyId"" 
                        FOREIGN KEY (""PropertyId"") REFERENCES ""Properties"" (""Id"") ON DELETE CASCADE;
                      END IF;
                    END $$;

                    -- 4. Create VerificationRecords table
                    CREATE TABLE IF NOT EXISTS ""VerificationRecords"" (
                        ""Id"" uuid NOT NULL,
                        ""PropertyId"" uuid NOT NULL,
                        ""AdminId"" uuid,
                        ""IsApproved"" boolean NOT NULL DEFAULT false,
                        ""Comments"" text NOT NULL DEFAULT '',
                        ""AgentReport"" text NOT NULL DEFAULT '',
                        ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        ""UpdatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        CONSTRAINT ""PK_VerificationRecords"" PRIMARY KEY (""Id"")
                    );

                    DO $$
                    BEGIN
                      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_VerificationRecords_Properties_PropertyId') THEN
                        ALTER TABLE ""VerificationRecords"" ADD CONSTRAINT ""FK_VerificationRecords_Properties_PropertyId"" 
                        FOREIGN KEY (""PropertyId"") REFERENCES ""Properties"" (""Id"") ON DELETE CASCADE;
                      END IF;
                    END $$;
                ");
                _columnsChecked = true;
                Console.WriteLine("[PropertyService] Ensured Properties and related tables are initialized successfully.");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[PropertyService] Schema auto-sync warning: {ex.Message}");
            }
            finally
            {
                _semaphore.Release();
            }
        }

        public async Task<IEnumerable<Property>> GetAllPropertiesAsync()
        {
            await EnsureColumnsExistAsync();
            return await _context.Properties
                .Include(p => p.Photos)
                .Include(p => p.Owner)
                .ToListAsync();
        }

        public async Task<Property?> GetPropertyByIdAsync(Guid id)
        {
            await EnsureColumnsExistAsync();
            try
            {
                var prop = await _context.Properties
                    .Include(p => p.Photos)
                    .Include(p => p.Owner)
                    .FirstOrDefaultAsync(p => p.Id == id);
                if (prop != null) return prop;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[PropertyService Warning] GetPropertyById with Owner query failed: {ex.Message}");
            }

            try
            {
                return await _context.Properties
                    .Include(p => p.Photos)
                    .FirstOrDefaultAsync(p => p.Id == id);
            }
            catch (Exception ex2)
            {
                Console.WriteLine($"[PropertyService Error] Fallback query failed: {ex2.Message}");
                return null;
            }
        }

        public async Task<IEnumerable<Property>> GetPropertiesByOwnerIdAsync(Guid ownerId)
        {
            await EnsureColumnsExistAsync();
            return await _context.Properties
                .Where(p => p.OwnerId == ownerId)
                .Include(p => p.Photos)
                .Include(p => p.Owner)
                .ToListAsync();
        }

        public async Task<Property> CreatePropertyAsync(Property property)
        {
            await EnsureColumnsExistAsync();
            await _context.Properties.AddAsync(property);
            await _context.SaveChangesAsync();
            return property;
        }

        public async Task UpdatePropertyAsync(Property property)
        {
            await EnsureColumnsExistAsync();
            _context.Properties.Update(property);
            await _context.SaveChangesAsync();
        }

        public async Task DeletePropertyAsync(Guid id)
        {
            var property = await _context.Properties
                .Include(p => p.Photos)
                .Include(p => p.Documents)
                .FirstOrDefaultAsync(p => p.Id == id);

            if (property != null)
            {
                if (property.Photos.Any())
                {
                    _context.PropertyPhotos.RemoveRange(property.Photos);
                }
                if (property.Documents.Any())
                {
                    _context.PropertyDocuments.RemoveRange(property.Documents);
                }

                _context.Properties.Remove(property);
                await _context.SaveChangesAsync();
            }
        }
    }
}
