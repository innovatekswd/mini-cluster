package handlers

import (
	"fmt"
	"regexp"
	"strings"
	"unicode"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

var nonAlphanumRe = regexp.MustCompile(`[^a-z0-9]+`)

// slugify converts a string to a URL-safe slug.
func slugify(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	// replace spaces and non-alphanumeric with dashes
	var b strings.Builder
	for _, r := range s {
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			b.WriteRune(r)
		} else {
			b.WriteByte('-')
		}
	}
	slug := nonAlphanumRe.ReplaceAllString(b.String(), "-")
	return strings.Trim(slug, "-")
}

// newUUID returns a new random UUID string.
func newUUID() string {
	return uuid.NewString()
}

// uniqueSlug ensures the slug is unique in the given table.
// excludeID is the current record ID to skip (empty for creates).
func uniqueSlug(db *gorm.DB, table, base, excludeID string) string {
	slug := base
	for i := 2; ; i++ {
		query := db.Table(table).Where("slug = ?", slug)
		if excludeID != "" {
			query = query.Where("id != ?", excludeID)
		}
		var count int64
		query.Count(&count)
		if count == 0 {
			return slug
		}
		slug = fmt.Sprintf("%s-%d", base, i)
	}
}
