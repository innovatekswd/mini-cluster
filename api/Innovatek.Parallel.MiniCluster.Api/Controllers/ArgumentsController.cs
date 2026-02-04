using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Innovatek.Parallel.MiniCluster.Core.Entities;
using Innovatek.Parallel.MiniCluster.Api.Data;
using Innovatek.Parallel.MiniCluster.Api.Services;

namespace Innovatek.Parallel.MiniCluster.Api.Controllers
{
    [ApiController]
    [Authorize]
    [Route("api/services/{identifier}/args")]
    public class ArgumentsController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly IIdentifierResolver _resolver;

        public ArgumentsController(AppDbContext db, IIdentifierResolver resolver)
        {
            _db = db;
            _resolver = resolver;
        }

        // GET: api/services/{identifier}/args
        [HttpGet]
        public async Task<IActionResult> GetArguments(string identifier)
        {
            var result = await _resolver.ResolveServiceAsync(identifier);
            if (!result.Success)
            {
                if (result.AmbiguousMatches != null)
                    return BadRequest(new { error = result.Error, matches = result.AmbiguousMatches });
                return NotFound(result.Error);
            }

            var service = await _db.Services.FindAsync(result.Value);
            if (service == null)
            {
                return NotFound();
            }
            return Ok(service.Arguments);
        }

        // PUT: api/services/{identifier}/args
        [HttpPut]
        public async Task<IActionResult> UpdateArguments(string identifier, [FromBody] ArgumentsDto dto)
        {
            var result = await _resolver.ResolveServiceAsync(identifier);
            if (!result.Success)
            {
                if (result.AmbiguousMatches != null)
                    return BadRequest(new { error = result.Error, matches = result.AmbiguousMatches });
                return NotFound(result.Error);
            }

            var service = await _db.Services.FindAsync(result.Value);
            if (service == null)
            {
                return NotFound();
            }

            service.Arguments = dto.Args;
            await _db.SaveChangesAsync();

            return Ok(service.Arguments);
        }
    }

    public class ArgumentsDto
    {
        public string Args { get; set; } = "";
    }
}

