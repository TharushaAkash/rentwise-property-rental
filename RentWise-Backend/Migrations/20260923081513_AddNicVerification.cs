using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RentWise.API.Migrations
{
    /// <inheritdoc />
    public partial class AddNicVerification : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsNicVerified",
                table: "Users",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "NicImageUrl",
                table: "Users",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsNicVerified",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "NicImageUrl",
                table: "Users");
        }
    }
}
