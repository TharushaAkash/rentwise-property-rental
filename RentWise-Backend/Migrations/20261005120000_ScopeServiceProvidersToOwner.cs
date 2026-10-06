using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RentWise.API.Data;

namespace RentWise.API.Migrations;

public partial class ScopeServiceProvidersToOwner : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<Guid>(name: "OwnerId", table: "ServiceProviders", type: "uuid", nullable: true);
        // Attribute legacy providers only when their assigned properties identify one owner.
        migrationBuilder.Sql(@"UPDATE ""ServiceProviders"" sp SET ""OwnerId"" = owners.owner_id
            FROM (SELECT r.""AssignedServiceProviderId"" provider_id,
                         (array_agg(DISTINCT p.""OwnerId""))[1] owner_id
                  FROM ""MaintenanceRequests"" r JOIN ""Properties"" p ON p.""Id"" = r.""PropertyId""
                  WHERE r.""AssignedServiceProviderId"" IS NOT NULL
                  GROUP BY r.""AssignedServiceProviderId"" HAVING COUNT(DISTINCT p.""OwnerId"") = 1) owners
            WHERE sp.""Id"" = owners.provider_id");
    }
    protected override void Down(MigrationBuilder migrationBuilder)
        => migrationBuilder.DropColumn(name: "OwnerId", table: "ServiceProviders");
}
