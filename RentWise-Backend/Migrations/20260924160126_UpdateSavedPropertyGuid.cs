using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RentWise.API.Migrations
{
    /// <inheritdoc />
    public partial class UpdateSavedPropertyGuid : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("TRUNCATE TABLE \"SavedProperties\" CASCADE;");

            migrationBuilder.DropColumn(
                name: "TenantProfileId",
                table: "SavedProperties");

            migrationBuilder.DropColumn(
                name: "PropertyId",
                table: "SavedProperties");

            migrationBuilder.AddColumn<Guid>(
                name: "TenantProfileId",
                table: "SavedProperties",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<Guid>(
                name: "PropertyId",
                table: "SavedProperties",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<int>(
                name: "TenantProfileId",
                table: "SavedProperties",
                type: "integer",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.AlterColumn<int>(
                name: "PropertyId",
                table: "SavedProperties",
                type: "integer",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uuid");
        }
    }
}
