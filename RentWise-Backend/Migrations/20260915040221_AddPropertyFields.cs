using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RentWise_Backend.Migrations
{
    /// <inheritdoc />
    public partial class AddPropertyFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<List<string>>(
                name: "FeatureTags",
                table: "Properties",
                type: "text[]",
                nullable: false);

            migrationBuilder.AddColumn<int>(
                name: "PhotoCount",
                table: "Properties",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "PropertyType",
                table: "Properties",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "Sqft",
                table: "Properties",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "FeatureTags",
                table: "Properties");

            migrationBuilder.DropColumn(
                name: "PhotoCount",
                table: "Properties");

            migrationBuilder.DropColumn(
                name: "PropertyType",
                table: "Properties");

            migrationBuilder.DropColumn(
                name: "Sqft",
                table: "Properties");
        }
    }
}
