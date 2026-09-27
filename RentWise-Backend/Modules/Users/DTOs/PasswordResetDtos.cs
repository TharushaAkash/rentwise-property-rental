using System.ComponentModel.DataAnnotations;

namespace RentWise.API.Modules.Users.DTOs;

public class ForgotPasswordDto
{
    [Required, EmailAddress, MaxLength(200)]
    public string Email { get; set; } = string.Empty;
}

public class VerifyPasswordOtpDto : ForgotPasswordDto
{
    [Required, RegularExpression(@"^[0-9]{6}$")]
    public string Code { get; set; } = string.Empty;
}

public class ResetPasswordDto : ForgotPasswordDto
{
    [Required, MaxLength(128)]
    public string ResetToken { get; set; } = string.Empty;

    [Required, MinLength(8), MaxLength(64)]
    public string NewPassword { get; set; } = string.Empty;

    [Required, Compare(nameof(NewPassword), ErrorMessage = "Passwords do not match.")]
    public string ConfirmPassword { get; set; } = string.Empty;
}
