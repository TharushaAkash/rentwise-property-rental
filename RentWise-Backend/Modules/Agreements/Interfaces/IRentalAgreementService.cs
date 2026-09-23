using System.Collections.Generic;
using System.Threading.Tasks;
using RentWise.API.Modules.Agreements.Entities;

namespace RentWise.API.Modules.Agreements.Interfaces
{
    public interface IRentalAgreementService
    {
        Task<IEnumerable<RentalAgreement>> GetAllAgreementsAsync();
        Task<RentalAgreement?> GetAgreementByIdAsync(Guid id);
        Task<RentalAgreement> CreateAgreementAsync(RentalAgreement agreement);
        Task UpdateAgreementAsync(RentalAgreement agreement);
        Task DeleteAgreementAsync(Guid id);
    }
}
