using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RentWise.API.Migrations
{
    /// <inheritdoc />
    public partial class AddPaymentPurpose : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Purpose",
                table: "Payments",
                type: "text",
                nullable: false,
                defaultValue: "Unspecified");
            migrationBuilder.Sql("UPDATE \"Payments\" SET \"Purpose\" = 'MonthlyRent' WHERE \"PaymentReference\" LIKE 'RENT-%'");
            migrationBuilder.Sql("UPDATE \"Payments\" SET \"Purpose\" = 'SecurityDeposit' WHERE \"PaymentReference\" LIKE 'PAY-%'");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Purpose",
                table: "Payments");
        }
    }
}
