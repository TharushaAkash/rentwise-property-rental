using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using BackendAssessment.Support;
using RentWise.API.Modules.Agreements.Entities;

namespace BackendAssessment;

[Collection("PostgreSQL assessment")]
public sealed class ApiIntegrationTests(PostgreSqlFixture fixture)
{
    private static object PropertyBody(Guid owner, string title = "Created assessment property") => new {
        ownerId = owner, title, description = "A spacious test house with garden", address = "12 Assessment Road, Colombo",
        monthlyRent = 50000, bedrooms = 3, bathrooms = 2, sqft = 1200, propertyType = "House", photoUrls = Array.Empty<string>(),
    };
    [Fact, Trait("Area", "API")]
    public async Task API_01_Create_property_returns_201_and_persists_pending_listing()
    {
        var seed = await fixture.SeedAsync();
        using var client = fixture.Factory.AsUser(seed.Owner.Id, "PropertyOwner");
        using var response = await client.PostAsJsonAsync("/api/properties", PropertyBody(seed.Owner.Id));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        var id = json.GetProperty("id").GetGuid();
        await using var db = fixture.OpenDb();
        var stored = await db.Properties.FindAsync(id);
        Assert.NotNull(stored); Assert.Equal(seed.Owner.Id, stored.OwnerId);
        Assert.Equal(50000m, stored.MonthlyRent); Assert.Equal("PendingVerification", json.GetProperty("status").GetString());
    }
    [Fact, Trait("Area", "API")]
    public async Task API_02_Read_property_returns_selected_fields()
    {
        var seed = await fixture.SeedAsync();
        using var client = fixture.Factory.AsUser(seed.Owner.Id, "PropertyOwner");
        using var response = await client.GetAsync($"/api/properties/{seed.Property.Id}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(seed.Property.Id, json.GetProperty("id").GetGuid());
        Assert.Equal(seed.Property.Address, json.GetProperty("address").GetString());
        Assert.Equal(50000m, json.GetProperty("monthlyRent").GetDecimal());
    }
    [Fact, Trait("Area", "API")]
    public async Task API_03_Update_property_persists_changes()
    {
        var seed = await fixture.SeedAsync();
        using var client = fixture.Factory.AsUser(seed.Owner.Id, "PropertyOwner");
        using var response = await client.PutAsJsonAsync($"/api/properties/{seed.Property.Id}", PropertyBody(seed.Owner.Id, "Updated assessment title"));
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        await using var db = fixture.OpenDb();
        Assert.Equal("Updated assessment title", (await db.Properties.FindAsync(seed.Property.Id))!.Title);
    }
    [Fact, Trait("Area", "API")]
    public async Task API_04_Delete_property_removes_row_and_detail_returns_404()
    {
        var seed = await fixture.SeedAsync();
        using var client = fixture.Factory.AsUser(seed.Owner.Id, "PropertyOwner");
        using var response = await client.DeleteAsync($"/api/properties/{seed.Property.Id}");
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        await using var db = fixture.OpenDb();
        Assert.Null(await db.Properties.FindAsync(seed.Property.Id));
        using var detail = await client.GetAsync($"/api/properties/{seed.Property.Id}");
        Assert.Equal(HttpStatusCode.NotFound, detail.StatusCode);
    }
    [Fact, Trait("Area", "API")]
    public async Task API_05_Search_applies_location_budget_bedrooms_and_type()
    {
        var location = $"Search-{Guid.NewGuid():N}";
        var seed = await fixture.SeedAsync(location);
        await fixture.SeedAsync($"Other-{Guid.NewGuid():N}");
        using var client = fixture.Factory.AsGuest();
        var path = $"/api/properties/browse?location={location}&minBudget=50000&maxBudget=50000&bedrooms=3&propertyType=house";
        using var response = await client.GetAsync(path);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        var items = json.GetProperty("items").EnumerateArray().ToArray();
        Assert.Single(items); Assert.Equal(seed.Property.Id, items[0].GetProperty("id").GetGuid());
        using var noMatch = await client.GetAsync(path.Replace("bedrooms=3", "bedrooms=4"));
        noMatch.EnsureSuccessStatusCode();
        Assert.Empty((await noMatch.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("items").EnumerateArray());
    }
    [Theory, Trait("Area", "API")]
    [InlineData("pageSize=0")][InlineData("pageSize=49")][InlineData("minBudget=-1")]
    [InlineData("maxBudget=-1")][InlineData("bedrooms=-1")][InlineData("cursor=not-a-guid")]
    public async Task API_06_Invalid_search_filters_return_400(string query)
    {
        using var client = fixture.Factory.AsGuest();
        using var response = await client.GetAsync($"/api/properties/browse?{query}");
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
    [Theory, Trait("Area", "API")]
    [InlineData(1)][InlineData(48)]
    public async Task API_06_Valid_page_size_boundaries_return_200(int size)
    {
        using var client = fixture.Factory.AsGuest();
        using var response = await client.GetAsync($"/api/properties/browse?pageSize={size}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }
    [Fact, Trait("Area", "API")]
    public async Task API_07_Create_agreement_persists_relationships_and_default_six_month_term()
    {
        var seed = await fixture.SeedAsync();
        using var client = fixture.Factory.AsUser(seed.Owner.Id, "PropertyOwner");
        var start = new DateTime(2026, 10, 1, 0, 0, 0, DateTimeKind.Utc);
        using var response = await client.PostAsJsonAsync("/api/agreements", new {
            propertyId = seed.Property.Id, tenantId = seed.Tenant.Id, agreedMonthlyRent = 50000,
            securityDeposit = 100000, startDate = start, termsAndConditions = "Assessment lease",
        });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        await using var db = fixture.OpenDb();
        var stored = await db.RentalAgreements.FindAsync(json.GetProperty("id").GetGuid());
        Assert.NotNull(stored); Assert.Equal(seed.Property.Id, stored.PropertyId);
        Assert.Equal(seed.Owner.Id, stored.OwnerId); Assert.Equal(seed.Tenant.Id, stored.TenantId);
        Assert.Equal(start.AddMonths(6), stored.EndDate);
    }
    [Fact, Trait("Area", "API")]
    public async Task API_09_Create_maintenance_as_owner_persists_request_and_initial_log()
    {
        var seed = await fixture.SeedAsync();
        using var client = fixture.Factory.AsUser(seed.Owner.Id, "PropertyOwner");
        using var response = await client.PostAsJsonAsync("/api/maintenance-requests", new {
            propertyId = seed.Property.Id, description = "Leaking kitchen tap", status = "Reported",
        });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        await using var db = fixture.OpenDb();
        var id = json.GetProperty("id").GetGuid();
        var stored = await db.MaintenanceRequests.FindAsync(id);
        Assert.NotNull(stored); Assert.Equal(seed.Owner.Id, stored.TenantId);
        Assert.Equal("Leaking kitchen tap", stored.Description);
        Assert.True(await db.RequestStatusLogs.AnyAsync(log => log.MaintenanceRequestId == id));
    }
    [Fact, Trait("Area", "Security")]
    public async Task API_11_Protected_create_without_authentication_returns_401()
    {
        using var client = fixture.Factory.AsGuest();
        using var response = await client.PostAsJsonAsync("/api/properties", PropertyBody(Guid.NewGuid()));
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }
    [Fact, Trait("Area", "Security")]
    public async Task API_12_Tenant_cannot_create_property_returns_403_and_no_row()
    {
        var seed = await fixture.SeedAsync();
        using var client = fixture.Factory.AsUser(seed.Tenant.Id, "Tenant");
        var title = $"Unauthorized-{Guid.NewGuid():N}";
        using var response = await client.PostAsJsonAsync("/api/properties", PropertyBody(seed.Owner.Id, title));
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        await using var db = fixture.OpenDb();
        Assert.False(await db.Properties.AnyAsync(p => p.Title == title));
    }
}
