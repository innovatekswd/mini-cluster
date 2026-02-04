// Package output provides different output formatters
package output

import (
	"encoding/json"
	"fmt"
	"io"
	"os"

	"gopkg.in/yaml.v3"
)

// Format represents an output format
type Format string

const (
	FormatTable Format = "table"
	FormatJSON  Format = "json"
	FormatYAML  Format = "yaml"
	FormatQuiet Format = "quiet"
)

// ParseFormat parses a format string
func ParseFormat(s string) Format {
	switch s {
	case "json":
		return FormatJSON
	case "yaml", "yml":
		return FormatYAML
	case "quiet", "q":
		return FormatQuiet
	default:
		return FormatTable
	}
}

// Formatter is the interface for output formatters
type Formatter interface {
	// Output writes formatted data
	Output(data interface{}) error
	// OutputTable writes tabular data
	OutputTable(headers []string, rows [][]string) error
	// Success writes a success message
	Success(format string, args ...interface{})
	// Error writes an error message
	Error(format string, args ...interface{})
	// Info writes an info message
	Info(format string, args ...interface{})
	// Writer returns the underlying writer
	Writer() io.Writer
}

// Options configures the formatter
type Options struct {
	Format  Format
	NoColor bool
	Writer  io.Writer
}

// NewFormatter creates a formatter based on options
func NewFormatter(opts Options) Formatter {
	if opts.Writer == nil {
		opts.Writer = os.Stdout
	}

	switch opts.Format {
	case FormatJSON:
		return &JSONFormatter{writer: opts.Writer}
	case FormatYAML:
		return &YAMLFormatter{writer: opts.Writer}
	case FormatQuiet:
		return &QuietFormatter{writer: opts.Writer}
	default:
		return &TableFormatter{
			writer:  opts.Writer,
			noColor: opts.NoColor,
		}
	}
}

// JSONFormatter outputs data as JSON
type JSONFormatter struct {
	writer io.Writer
}

func (f *JSONFormatter) Output(data interface{}) error {
	encoder := json.NewEncoder(f.writer)
	encoder.SetIndent("", "  ")
	return encoder.Encode(data)
}

func (f *JSONFormatter) OutputTable(headers []string, rows [][]string) error {
	// Convert to array of maps
	var items []map[string]string
	for _, row := range rows {
		item := make(map[string]string)
		for i, header := range headers {
			if i < len(row) {
				item[header] = row[i]
			}
		}
		items = append(items, item)
	}
	return f.Output(items)
}

func (f *JSONFormatter) Success(format string, args ...interface{}) {
	// JSON output suppresses messages
}

func (f *JSONFormatter) Error(format string, args ...interface{}) {
	fmt.Fprintf(os.Stderr, format+"\n", args...)
}

func (f *JSONFormatter) Info(format string, args ...interface{}) {
	// JSON output suppresses messages
}

func (f *JSONFormatter) Writer() io.Writer {
	return f.writer
}

// YAMLFormatter outputs data as YAML
type YAMLFormatter struct {
	writer io.Writer
}

func (f *YAMLFormatter) Output(data interface{}) error {
	return yaml.NewEncoder(f.writer).Encode(data)
}

func (f *YAMLFormatter) OutputTable(headers []string, rows [][]string) error {
	var items []map[string]string
	for _, row := range rows {
		item := make(map[string]string)
		for i, header := range headers {
			if i < len(row) {
				item[header] = row[i]
			}
		}
		items = append(items, item)
	}
	return f.Output(items)
}

func (f *YAMLFormatter) Success(format string, args ...interface{}) {
	// YAML output suppresses messages
}

func (f *YAMLFormatter) Error(format string, args ...interface{}) {
	fmt.Fprintf(os.Stderr, format+"\n", args...)
}

func (f *YAMLFormatter) Info(format string, args ...interface{}) {
	// YAML output suppresses messages
}

func (f *YAMLFormatter) Writer() io.Writer {
	return f.writer
}

// QuietFormatter outputs minimal data
type QuietFormatter struct {
	writer io.Writer
}

func (f *QuietFormatter) Output(data interface{}) error {
	// Quiet mode - minimal output
	return nil
}

func (f *QuietFormatter) OutputTable(headers []string, rows [][]string) error {
	// Output only the first column (typically ID)
	for _, row := range rows {
		if len(row) > 0 {
			fmt.Fprintln(f.writer, row[0])
		}
	}
	return nil
}

func (f *QuietFormatter) Success(format string, args ...interface{}) {
	// Suppress in quiet mode
}

func (f *QuietFormatter) Error(format string, args ...interface{}) {
	fmt.Fprintf(os.Stderr, format+"\n", args...)
}

func (f *QuietFormatter) Info(format string, args ...interface{}) {
	// Suppress in quiet mode
}

func (f *QuietFormatter) Writer() io.Writer {
	return f.writer
}
