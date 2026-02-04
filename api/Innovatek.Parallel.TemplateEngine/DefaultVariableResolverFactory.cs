using System;
using System.Collections.Generic;
using System.Text;

namespace Innovatek.Parallel.TemplateEngine
{
    public class DefaultVariableResolverFactory: IVariableResolverFactory
    {
        public IVariableResolver CreateResolver(Dictionary<string, string> variables)
        {
            return new DefaultVariableResolver(variables);
        }
    }
    
}
