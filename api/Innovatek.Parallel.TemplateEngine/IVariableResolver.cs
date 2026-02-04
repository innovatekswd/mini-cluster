using System;
using System.Collections.Generic;
using System.Text;
using System.Threading.Tasks;

namespace Innovatek.Parallel.TemplateEngine
{
    public interface IVariableResolver
    {
        Task<(string Result, bool IsCircular, string CircularVariable)>  ResolveVariablesAsync(string input);

    }
}
