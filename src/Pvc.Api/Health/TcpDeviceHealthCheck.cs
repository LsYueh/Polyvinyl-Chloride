using Microsoft.Extensions.Diagnostics.HealthChecks;
using Pvc.Api.Services.Tcp;

namespace Pvc.Api.Health;

public class TcpDeviceHealthCheck(ConnectionManager manager) : IHealthCheck
{
    private readonly ConnectionManager _manager = manager;

    public Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        var count = _manager.GetConnections().Count;

        if (count > 0)
            return Task.FromResult(HealthCheckResult.Healthy("devices connected"));

        return Task.FromResult(HealthCheckResult.Degraded("no devices"));
    }
}
