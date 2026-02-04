package output

import (
	"fmt"
	"io"
	"strings"
)

// TableFormatter outputs data as formatted tables
type TableFormatter struct {
	writer  io.Writer
	noColor bool
}

func (f *TableFormatter) Output(data interface{}) error {
	// For generic data, output as formatted string
	fmt.Fprintf(f.writer, "%+v\n", data)
	return nil
}

func (f *TableFormatter) OutputTable(headers []string, rows [][]string) error {
	if len(rows) == 0 {
		return nil
	}

	// Calculate column widths
	widths := make([]int, len(headers))
	for i, h := range headers {
		widths[i] = len(h)
	}
	for _, row := range rows {
		for i, cell := range row {
			if i < len(widths) && len(cell) > widths[i] {
				widths[i] = len(cell)
			}
		}
	}

	// Apply min/max constraints
	for i := range widths {
		if widths[i] < 4 {
			widths[i] = 4
		}
		if widths[i] > 50 {
			widths[i] = 50
		}
	}

	// Build format string
	var formats []string
	for _, w := range widths {
		formats = append(formats, fmt.Sprintf("%%-%ds", w))
	}
	format := strings.Join(formats, "  ") + "\n"

	// Print header
	headerArgs := make([]interface{}, len(headers))
	for i, h := range headers {
		headerArgs[i] = strings.ToUpper(h)
	}
	if f.noColor {
		fmt.Fprintf(f.writer, format, headerArgs...)
	} else {
		fmt.Fprintf(f.writer, "\033[1m"+format+"\033[0m", headerArgs...)
	}

	// Print rows
	for _, row := range rows {
		rowArgs := make([]interface{}, len(widths))
		for i := range widths {
			if i < len(row) {
				cell := row[i]
				// Truncate if needed
				if len(cell) > widths[i] {
					cell = cell[:widths[i]-3] + "..."
				}
				rowArgs[i] = cell
			} else {
				rowArgs[i] = ""
			}
		}
		fmt.Fprintf(f.writer, format, rowArgs...)
	}

	return nil
}

func (f *TableFormatter) Success(format string, args ...interface{}) {
	if f.noColor {
		fmt.Fprintf(f.writer, "✓ "+format+"\n", args...)
	} else {
		fmt.Fprintf(f.writer, "\033[32m✓ "+format+"\033[0m\n", args...)
	}
}

func (f *TableFormatter) Error(format string, args ...interface{}) {
	if f.noColor {
		fmt.Fprintf(f.writer, "✗ "+format+"\n", args...)
	} else {
		fmt.Fprintf(f.writer, "\033[31m✗ "+format+"\033[0m\n", args...)
	}
}

func (f *TableFormatter) Info(format string, args ...interface{}) {
	if f.noColor {
		fmt.Fprintf(f.writer, format+"\n", args...)
	} else {
		fmt.Fprintf(f.writer, "\033[36m"+format+"\033[0m\n", args...)
	}
}

func (f *TableFormatter) Writer() io.Writer {
	return f.writer
}
