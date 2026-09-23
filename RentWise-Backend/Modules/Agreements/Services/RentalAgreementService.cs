using System.Collections.Generic;
using System.Threading.Tasks;
using RentWise.API.Common.Interfaces;
using RentWise.API.Modules.Agreements.Entities;
using RentWise.API.Modules.Agreements.Interfaces;

namespace RentWise.API.Modules.Agreements.Services
{
    public class RentalAgreementService : IRentalAgreementService
    {
        private readonly IRepository<RentalAgreement> _agreementRepository;

        public RentalAgreementService(IRepository<RentalAgreement> agreementRepository)
        {
            _agreementRepository = agreementRepository;
        }

        public async Task<IEnumerable<RentalAgreement>> GetAllAgreementsAsync()
        {
            return await _agreementRepository.GetAllAsync();
        }

        public async Task<RentalAgreement?> GetAgreementByIdAsync(Guid id)
        {
            return await _agreementRepository.GetByIdAsync(id);
        }

        public async Task<RentalAgreement> CreateAgreementAsync(RentalAgreement agreement)
        {
            return await _agreementRepository.AddAsync(agreement);
        }

        public async Task UpdateAgreementAsync(RentalAgreement agreement)
        {
            await _agreementRepository.UpdateAsync(agreement);
        }

        public async Task DeleteAgreementAsync(Guid id)
        {
            var agreement = await _agreementRepository.GetByIdAsync(id);
            if (agreement != null)
            {
                await _agreementRepository.DeleteAsync(agreement);
            }
        }
    }
}
