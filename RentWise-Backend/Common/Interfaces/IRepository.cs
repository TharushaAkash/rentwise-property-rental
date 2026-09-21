using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using RentWise_Backend.Models;

namespace RentWise_Backend.Common.Interfaces
{
    public interface IRepository<T> where T : BaseEntity
    {
        Task<IEnumerable<T>> GetAllAsync();
        Task<T?> GetByIdAsync(Guid id);
        Task<T> AddAsync(T entity);
        Task UpdateAsync(T entity);
        Task DeleteAsync(T entity);
    }
}
