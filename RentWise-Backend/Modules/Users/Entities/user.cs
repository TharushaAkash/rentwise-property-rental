using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using RentWise.API.Common;

namespace RentWise.API.Modules.Users
{
    [Table("Users")]
    public class User : BaseEntity
    {
        [Required]
        [MaxLength(150)]
        public string Name { get; set; } = string.Empty;

        [Required]
        [MaxLength(200)]
        public string Email { get; set; } = string.Empty;

        [Required]
        [MaxLength(300)]
        [System.Text.Json.Serialization.JsonIgnore]
        public string PasswordHash { get; set; } = string.Empty;


        [Required]
        [MaxLength(20)]
        public string Role { get; set; } = "Tenant"; // 'Tenant' | 'Owner' | 'Admin'

        [MaxLength(20)]
        public string? PhoneNumber { get; set; }

        [MaxLength(20)]
        [System.Text.Json.Serialization.JsonIgnore]
        public string? NicNumber { get; set; }

        public bool IsNicVerified { get; set; } = false;

        [MaxLength(500)]
        [System.Text.Json.Serialization.JsonIgnore]
        public string? NicImageUrl { get; set; }

        public bool IsBlocked { get; set; } = false;
        [MaxLength(120), System.Text.Json.Serialization.JsonIgnore]
        public string? BankName { get; set; }
        [MaxLength(150), System.Text.Json.Serialization.JsonIgnore]
        public string? BankAccountName { get; set; }
        [MaxLength(40), System.Text.Json.Serialization.JsonIgnore]
        public string? BankAccountNumber { get; set; }
        [MaxLength(120), System.Text.Json.Serialization.JsonIgnore]
        public string? BankBranch { get; set; }
    }
}
