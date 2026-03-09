using Microsoft.AspNetCore.Mvc;

using Pvc.Api.Services;

namespace Pvc.Api.Controllers;

[ApiController]
[Route("api/devices")]
public class DeviceController(TcpConnectionManager manager) : ControllerBase
{
    private readonly TcpConnectionManager _manager = manager;

    [HttpGet]
    public IActionResult List()
    {
        return Ok(_manager.GetConnections());
    }
    
    [HttpGet("status")]
    public IActionResult Status()
    {
        var devices = _manager.GetStatus();

        return Ok(new
        {
            connected = devices.Count(x => x.Connected),
            total = devices.Count,
            devices
        });
    }

    [HttpGet("{id}/status")]
    public IActionResult Status(string id)
    {
        var device = _manager.GetDeviceStatus(id);

        if (device == null)
            return NotFound();

        return Ok(device);
    }
    
    [HttpPost("{id}/connect")]
    public async Task<IActionResult> Connect(string id, string host, int port)
    {
        await _manager.Connect(id, host, port);
        return Ok();
    }

    [HttpPost("{id}/send")]
    public async Task<IActionResult> Send(string id, [FromBody] string msg)
    {
        await _manager.Send(id, msg);
        return Ok();
    }

    [HttpPost("{id}/disconnect")]
    public IActionResult Disconnect(string id)
    {
        _manager.Disconnect(id);
        return Ok();
    }
}