using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace RentWise.API.Modules.Users.DTOs
{
    public class RegisterDto
    {
        [Required(ErrorMessage = "Full name is required.")]
        [MaxLength(150)]
        public string Name { get; set; } = string.Empty;

        [JsonPropertyName("fullName")]
        public string? FullName
        {
            get => Name;
            set
            {
                if (!string.IsNullOrWhiteSpace(value) && string.IsNullOrWhiteSpace(Name))
                {
                    Name = value;
                }
            }
        }

        [Required(ErrorMessage = "Email is required.")]
        [EmailAddress(ErrorMessage = "Invalid email address format.")]
        [MaxLength(200)]
        public string Email { get; set; } = string.Empty;

        [Required(ErrorMessage = "Password is required.")]
        [MinLength(8, ErrorMessage = "Password must be at least 8 characters.")]
        public string Password { get; set; } = string.Empty;

        [Required]
        public string Role { get; set; } = "Tenant"; // 'Tenant' | 'Owner' | 'Admin'

        [Required(ErrorMessage = "Phone number is required.")]
        [RegularExpression(@"^\d{10}$", ErrorMessage = "Phone number must be exactly 10 digits.")]
        public string PhoneNumber { get; set; } = string.Empty;

        [Required(ErrorMessage = "NIC number is required.")]
        [RegularExpression(@"^([0-9]{9}[vV]|[0-9]{12})$", ErrorMessage = "NIC must be 12 digits or 9 digits followed by 'V'.")]
        public string NicNumber { get; set; } = string.Empty;
    }

    public class LoginDto
    {
        [Required]
        [EmailAddress]
        public string Email { get; set; } = string.Empty;

        [Required]
        public string Password { get; set; } = string.Empty;
    }

    public class AuthResponseDto
    {
        public string Token { get; set; } = string.Empty;
        public UserDto User { get; set; } = null!;
    }

    public class UserDto
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string FullName => Name;
        public string FirstName => Name.Split(' ', 2).FirstOrDefault() ?? string.Empty;
        public string LastName => Name.Contains(' ') ? Name.Substring(Name.IndexOf(' ') + 1) : string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public string? PhoneNumber { get; set; }
        public string? NicNumber { get; set; }
        public bool IsBlocked { get; set; } = false;
        public DateTime CreatedAt { get; set; }
    }

    public class UpdateProfileDto
    {
        [MaxLength(150)]
        public string? Name { get; set; }

        [JsonPropertyName("fullName")]
        public string? FullName
        {
            get => Name;
            set
            {
                if (!string.IsNullOrWhiteSpace(value) && string.IsNullOrWhiteSpace(Name))
                {
                    Name = value;
                }
            }
        }

        public string? FirstName { get; set; }
        public string? LastName { get; set; }

        [RegularExpression(@"^\d{10}$", ErrorMessage = "Phone number must be exactly 10 digits.")]
        public string? PhoneNumber { get; set; }

        [RegularExpression(@"^([0-9]{9}[vV]|[0-9]{12})$", ErrorMessage = "NIC must be 12 digits or 9 digits followed by 'V'.")]
        public string? NicNumber { get; set; }
    }

    public class ChangePasswordDto
    {
        [Required(ErrorMessage = "Current password is required.")]
        public string CurrentPassword { get; set; } = string.Empty;

        [Required(ErrorMessage = "New password is required.")]
        [MinLength(8, ErrorMessage = "New password must be at least 8 characters.")]
        public string NewPassword { get; set; } = string.Empty;
    }

    public class UpdateRoleDto
    {
        [Required]
        public string Role { get; set; } = string.Empty;
    }

    public class BlockUserDto
    {
        public bool? IsBlocked { get; set; }
    }
}
