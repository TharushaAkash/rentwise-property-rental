using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RentWise.API.Migrations
{
    /// <inheritdoc />
    public partial class AddDurableRentalWorkflows : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "Attempt",
                table: "AgentWorkflowSteps",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "InputJson",
                table: "AgentWorkflowSteps",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "Sequence",
                table: "AgentWorkflowSteps",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<Guid>(
                name: "AgreementId",
                table: "AgentWorkflowRuns",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "PropertyId",
                table: "AgentWorkflowRuns",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "RequestedById",
                table: "AgentWorkflowRuns",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ReviewerId",
                table: "AgentWorkflowRuns",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "StateJson",
                table: "AgentWorkflowRuns",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "Version",
                table: "AgentWorkflowRuns",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateIndex(
                name: "IX_AgentWorkflowRuns_RequestedById_CreatedAt",
                table: "AgentWorkflowRuns",
                columns: new[] { "RequestedById", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_AgentWorkflowRuns_ReviewerId_Status",
                table: "AgentWorkflowRuns",
                columns: new[] { "ReviewerId", "Status" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_AgentWorkflowRuns_RequestedById_CreatedAt",
                table: "AgentWorkflowRuns");

            migrationBuilder.DropIndex(
                name: "IX_AgentWorkflowRuns_ReviewerId_Status",
                table: "AgentWorkflowRuns");

            migrationBuilder.DropColumn(
                name: "Attempt",
                table: "AgentWorkflowSteps");

            migrationBuilder.DropColumn(
                name: "InputJson",
                table: "AgentWorkflowSteps");

            migrationBuilder.DropColumn(
                name: "Sequence",
                table: "AgentWorkflowSteps");

            migrationBuilder.DropColumn(
                name: "AgreementId",
                table: "AgentWorkflowRuns");

            migrationBuilder.DropColumn(
                name: "PropertyId",
                table: "AgentWorkflowRuns");

            migrationBuilder.DropColumn(
                name: "RequestedById",
                table: "AgentWorkflowRuns");

            migrationBuilder.DropColumn(
                name: "ReviewerId",
                table: "AgentWorkflowRuns");

            migrationBuilder.DropColumn(
                name: "StateJson",
                table: "AgentWorkflowRuns");

            migrationBuilder.DropColumn(
                name: "Version",
                table: "AgentWorkflowRuns");
        }
    }
}
