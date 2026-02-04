using System;
using System.Collections.Generic;
using System.Text;

namespace Innovatek.Parallel.TemplateEngine
{
    public interface IVariableResolverFactory
    {
        IVariableResolver CreateResolver(Dictionary<string, string> variables);
    }
}
