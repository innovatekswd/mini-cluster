using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Threading.Tasks;
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
    [Route("api/services/{identifier}/env")]
    public class EnvironmentController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly IIdentifierResolver _resolver;

        public EnvironmentController(AppDbContext db, IIdentifierResolver resolver)
        {
            _db = db;
            _resolver = resolver;
        }

        // GET: api/services/{identifier}/env
        [HttpGet]
        public async Task<IActionResult> GetEnvVariables(string identifier)
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

            return Ok(service.EnvironmentVariables);
        }

        // PUT: api/services/{identifier}/env
        [HttpPut]
        public async Task<IActionResult> UpdateEnvVariables(string identifier, [FromBody] Dictionary<string, string> envVars)
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

            service.EnvironmentVariables = envVars;
            await _db.SaveChangesAsync();

            return Ok(envVars);
        }
    }
}

