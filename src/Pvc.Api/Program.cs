using Microsoft.Extensions.Diagnostics.HealthChecks;

using Pvc.Api.Health;
using Pvc.Api.Services.Tcp;

namespace Pvc.Api;

class Program
{
    static void Main(string[] args)
    {
        var builder = WebApplication.CreateBuilder(args);

        // === 1. 註冊服務 ===
        ConfigureServices(builder.Services);

        var app = builder.Build();

        // === 2. 設定 middleware ===
        ConfigureMiddleware(app);

        // === 3. Map API endpoints ===
        MapControllers(app);
        MapHealthEndpoints(app);

        // === 4. Run app ===
        app.Run();
    }

    private static void ConfigureServices(IServiceCollection services)
    {
        services.AddControllers();

        services.AddEndpointsApiExplorer();
        services.AddSwaggerGen(options =>
        {
            options.SwaggerDoc("v1", new()
            {
                Title = "PVC API",
                Version = "v1"
            });
        });

        // TCP device manager
        services.AddSingleton<ConnectionManager>();

        // Health checks
        services.AddHealthChecks()
            .AddCheck<TcpDeviceHealthCheck>("tcp_devices");
    }

    private static void ConfigureMiddleware(WebApplication app)
    {
        if (app.Environment.IsDevelopment())
        {
            app.UseSwagger();
            app.UseSwaggerUI();
        }

        app.UseRouting();
    }

    private static void MapControllers(WebApplication app)
    {
        app.MapControllers();
    }

    private static void MapHealthEndpoints(WebApplication app)
    {
        // /health → process alive
        app.MapGet("/health", async (HealthCheckService healthCheckService) =>
        {
            var result = await healthCheckService.CheckHealthAsync(check => false);
            return Results.Ok(new { status = result.Status.ToString() });
        })
        .WithTags("System")
        .WithOpenApi();

        // /ready → tcp devices ready
        app.MapGet("/ready", async (HealthCheckService healthCheckService) =>
        {
            var result = await healthCheckService.CheckHealthAsync(
                check => check.Name == "tcp_devices");

            var status = result.Status == HealthStatus.Healthy ? 200 : 503;

            return Results.Json(new
            {
                status = result.Status.ToString(),
                checks = result.Entries.Select(e => new
                {
                    name = e.Key,
                    status = e.Value.Status.ToString()
                })
            }, statusCode: status);
        })
        .WithTags("System")
        .WithOpenApi();
    }
}

