import { useEffect, useRef, useState, useCallback } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";
import { terminalService } from "../services/terminalService";

interface TerminalProps {
  workingDirectory?: string;
  onExit?: (exitCode: number) => void;
  className?: string;
}

export function Terminal({ workingDirectory, onExit, className = "" }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const terminalIdRef = useRef<string | null>(null);
  const onExitRef = useRef(onExit);
  const cleanupRef = useRef<(() => void) | null>(null);
  const initedRef = useRef(false);
  
  const [isConnecting, setIsConnecting] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Keep onExit ref updated
  useEffect(() => {
    onExitRef.current = onExit;
  }, [onExit]);

  // Initialize terminal - only once
  useEffect(() => {
    if (!terminalRef.current || initedRef.current) return;
    initedRef.current = true;

    // Create xterm instance
    const xterm = new XTerm({
      cursorBlink: true,
      cursorStyle: "block",
      fontSize: 14,
      fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: "#1e1e2e",
        foreground: "#cdd6f4",
        cursor: "#f5e0dc",
        cursorAccent: "#1e1e2e",
        selectionBackground: "#585b70",
        selectionForeground: "#cdd6f4",
        black: "#45475a",
        red: "#f38ba8",
        green: "#a6e3a1",
        yellow: "#f9e2af",
        blue: "#89b4fa",
        magenta: "#f5c2e7",
        cyan: "#94e2d5",
        white: "#bac2de",
        brightBlack: "#585b70",
        brightRed: "#f38ba8",
        brightGreen: "#a6e3a1",
        brightYellow: "#f9e2af",
        brightBlue: "#89b4fa",
        brightMagenta: "#f5c2e7",
        brightCyan: "#94e2d5",
        brightWhite: "#a6adc8",
      },
      allowProposedApi: true,
      scrollback: 10000,
    });

    // Add addons
    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    
    xterm.loadAddon(fitAddon);
    xterm.loadAddon(webLinksAddon);

    // Open terminal
    xterm.open(terminalRef.current);
    
    // Give it time to render before fitting
    setTimeout(() => {
      fitAddon.fit();
    }, 100);

    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;

    // Create terminal session
    const initTerminal = async () => {
      try {
        setIsConnecting(true);
        setError(null);

        // Wait a bit for xterm to initialize
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const cols = xterm.cols || 80;
        const rows = xterm.rows || 24;
        
        const id = await terminalService.createTerminal(workingDirectory, cols, rows);
        terminalIdRef.current = id;

        // Handle terminal data (output)
        const unsubData = terminalService.onData(id, (_termId, data) => {
          xterm.write(data);
        });

        // Handle terminal exit
        const unsubExit = terminalService.onExit(id, (_termId, exitCode) => {
          xterm.writeln(`\r\n\x1b[33m[Process exited with code ${exitCode}]\x1b[0m`);
          onExitRef.current?.(exitCode);
        });

        // Handle terminal errors
        const unsubError = terminalService.onError(id, (_termId, err) => {
          xterm.writeln(`\r\n\x1b[31m[Error: ${err}]\x1b[0m`);
        });

        // Handle user input
        const disposeData = xterm.onData(async (data) => {
          try {
            await terminalService.writeToTerminal(id, data);
          } catch (err) {
            console.error("Failed to write to terminal:", err);
          }
        });

        setIsConnecting(false);

        // Store cleanup function
        cleanupRef.current = () => {
          unsubData();
          unsubExit();
          unsubError();
          disposeData.dispose();
          terminalService.closeTerminal(id).catch(() => {});
        };

      } catch (err) {
        console.error("Failed to initialize terminal:", err);
        setError(err instanceof Error ? err.message : "Failed to connect to terminal");
        setIsConnecting(false);
      }
    };

    initTerminal();

    return () => {
      cleanupRef.current?.();
      xterm.dispose();
      initedRef.current = false;
    };
  }, [workingDirectory]); // Only depend on workingDirectory

  // Handle resize
  useEffect(() => {
    if (!fitAddonRef.current) return;

    const handleResize = () => {
      if (fitAddonRef.current && xtermRef.current) {
        try {
          fitAddonRef.current.fit();
          const cols = xtermRef.current.cols;
          const rows = xtermRef.current.rows;
          if (terminalIdRef.current) {
            terminalService.resizeTerminal(terminalIdRef.current, cols, rows).catch(() => {});
          }
        } catch (e) {
          // Ignore resize errors
        }
      }
    };

    // Debounced resize
    let resizeTimeout: ReturnType<typeof setTimeout>;
    const debouncedResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(handleResize, 100);
    };

    // Resize observer for container
    const resizeObserver = new ResizeObserver(debouncedResize);

    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current);
    }

    // Window resize
    window.addEventListener("resize", debouncedResize);

    return () => {
      clearTimeout(resizeTimeout);
      resizeObserver.disconnect();
      window.removeEventListener("resize", debouncedResize);
    };
  }, []);

  // Focus terminal on click
  const handleContainerClick = useCallback(() => {
    xtermRef.current?.focus();
  }, []);

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-gray-900 text-red-400 p-4 ${className}`}>
        <div className="text-center">
          <svg className="w-12 h-12 mx-auto mb-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-lg font-medium">Failed to connect to terminal</p>
          <p className="text-sm text-gray-400 mt-2">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`relative bg-[#1e1e2e] ${className}`}
      onClick={handleContainerClick}
    >
      {isConnecting && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 z-10">
          <div className="flex items-center space-x-3">
            <svg className="animate-spin h-6 w-6 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="text-gray-300">Connecting to terminal...</span>
          </div>
        </div>
      )}
      <div 
        ref={terminalRef}
        className="w-full h-full"
        style={{ padding: "8px" }}
      />
    </div>
  );
}
