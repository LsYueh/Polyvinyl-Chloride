namespace Pvc.Api.Models;

public class DeviceStatus
{
    public string Id { get; set; } = "";

    public string Host { get; set; } = "";

    public int Port { get; set; }

    public bool Connected { get; set; }
}
