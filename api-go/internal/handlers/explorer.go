package handlers

import (
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/go-chi/chi/v5"
)

// ExplorerConfig controls which root paths the explorer may access.
type ExplorerConfig struct {
	AllowedRoots   []string
	MaxUploadBytes int64
}

type ExplorerHandler struct {
	cfg ExplorerConfig
}

func NewExplorerHandler(cfg ExplorerConfig) *ExplorerHandler {
	return &ExplorerHandler{cfg: cfg}
}

func (h *ExplorerHandler) Routes() chi.Router {
	r := chi.NewRouter()
	r.Get("/roots", h.roots)
	r.Get("/list", h.list)
	r.Get("/info", h.info)
	r.Get("/file", h.readFile)
	r.Put("/file", h.writeFile)
	r.Delete("/file", h.deleteFile)
	r.Post("/archive", h.archive)
	r.Post("/extract", h.extract)
	return r
}

// FileRoutes mounts upload/download endpoints separately.
func (h *ExplorerHandler) FileRoutes() chi.Router {
	r := chi.NewRouter()
	r.Post("/upload", h.upload)
	r.Post("/upload-multiple", h.uploadMultiple)
	r.Get("/download", h.download)
	return r
}

func (h *ExplorerHandler) roots(w http.ResponseWriter, r *http.Request) {
	type rootEntry struct {
		Path string `json:"path"`
		Name string `json:"name"`
	}
	roots := make([]rootEntry, 0, len(h.cfg.AllowedRoots))
	for _, root := range h.cfg.AllowedRoots {
		roots = append(roots, rootEntry{Path: root, Name: filepath.Base(root)})
	}
	writeJSON(w, http.StatusOK, roots)
}

func (h *ExplorerHandler) list(w http.ResponseWriter, r *http.Request) {
	dir := r.URL.Query().Get("path")
	if err := h.guardPath(dir); err != nil {
		writeError(w, http.StatusForbidden, err.Error())
		return
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	type fileEntry struct {
		Name  string `json:"name"`
		Path  string `json:"path"`
		IsDir bool   `json:"isDir"`
		Size  int64  `json:"size"`
	}
	result := make([]fileEntry, 0, len(entries))
	for _, e := range entries {
		info, _ := e.Info()
		size := int64(0)
		if info != nil {
			size = info.Size()
		}
		result = append(result, fileEntry{
			Name:  e.Name(),
			Path:  filepath.Join(dir, e.Name()),
			IsDir: e.IsDir(),
			Size:  size,
		})
	}
	writeJSON(w, http.StatusOK, result)
}

func (h *ExplorerHandler) info(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Query().Get("path")
	if err := h.guardPath(path); err != nil {
		writeError(w, http.StatusForbidden, err.Error())
		return
	}
	info, err := os.Stat(path)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"name":    info.Name(),
		"path":    path,
		"isDir":   info.IsDir(),
		"size":    info.Size(),
		"modTime": info.ModTime(),
	})
}

func (h *ExplorerHandler) readFile(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Query().Get("path")
	if err := h.guardPath(path); err != nil {
		writeError(w, http.StatusForbidden, err.Error())
		return
	}
	data, err := os.ReadFile(path)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(data)
}

func (h *ExplorerHandler) writeFile(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Query().Get("path")
	if err := h.guardPath(path); err != nil {
		writeError(w, http.StatusForbidden, err.Error())
		return
	}
	data, err := io.ReadAll(io.LimitReader(r.Body, h.maxUpload()))
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if err := os.WriteFile(path, data, 0o644); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *ExplorerHandler) deleteFile(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Query().Get("path")
	if err := h.guardPath(path); err != nil {
		writeError(w, http.StatusForbidden, err.Error())
		return
	}
	if err := os.Remove(path); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *ExplorerHandler) archive(w http.ResponseWriter, r *http.Request) {
	writeError(w, http.StatusNotImplemented, "archive not yet implemented")
}

func (h *ExplorerHandler) extract(w http.ResponseWriter, r *http.Request) {
	writeError(w, http.StatusNotImplemented, "extract not yet implemented")
}

func (h *ExplorerHandler) download(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Query().Get("path")
	if err := h.guardPath(path); err != nil {
		writeError(w, http.StatusForbidden, err.Error())
		return
	}
	info, err := os.Stat(path)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	if info.IsDir() {
		writeError(w, http.StatusBadRequest, "cannot download a directory directly")
		return
	}
	w.Header().Set("Content-Disposition", "attachment; filename="+filepath.Base(path))
	http.ServeFile(w, r, path)
}

func (h *ExplorerHandler) upload(w http.ResponseWriter, r *http.Request) {
	destDir := r.URL.Query().Get("path")
	if err := h.guardPath(destDir); err != nil {
		writeError(w, http.StatusForbidden, err.Error())
		return
	}
	if err := r.ParseMultipartForm(h.maxUpload()); err != nil {
		writeError(w, http.StatusBadRequest, "multipart parse error")
		return
	}
	f, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, "missing file field")
		return
	}
	defer f.Close()
	dest := filepath.Join(destDir, filepath.Base(header.Filename))
	out, err := os.Create(dest)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer out.Close()
	_, _ = io.Copy(out, f)
	writeJSON(w, http.StatusOK, map[string]string{"path": dest})
}

func (h *ExplorerHandler) uploadMultiple(w http.ResponseWriter, r *http.Request) {
	destDir := r.URL.Query().Get("path")
	if err := h.guardPath(destDir); err != nil {
		writeError(w, http.StatusForbidden, err.Error())
		return
	}
	if err := r.ParseMultipartForm(h.maxUpload()); err != nil {
		writeError(w, http.StatusBadRequest, "multipart parse error")
		return
	}
	var saved []string
	for _, headers := range r.MultipartForm.File {
		for _, header := range headers {
			f, err := header.Open()
			if err != nil {
				continue
			}
			dest := filepath.Join(destDir, filepath.Base(header.Filename))
			out, err := os.Create(dest)
			if err != nil {
				f.Close()
				continue
			}
			_, _ = io.Copy(out, f)
			out.Close()
			f.Close()
			saved = append(saved, dest)
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"uploaded": saved})
}

// guardPath ensures the requested path is under an allowed root and contains no traversal.
func (h *ExplorerHandler) guardPath(path string) error {
	if path == "" {
		return os.ErrInvalid
	}
	clean := filepath.Clean(path)
	// prevent traversal components
	if strings.Contains(clean, "..") {
		return os.ErrPermission
	}
	for _, root := range h.cfg.AllowedRoots {
		if strings.HasPrefix(clean, filepath.Clean(root)) {
			return nil
		}
	}
	return os.ErrPermission
}

func (h *ExplorerHandler) maxUpload() int64 {
	if h.cfg.MaxUploadBytes > 0 {
		return h.cfg.MaxUploadBytes
	}
	return 100 * 1024 * 1024 // 100 MB default
}
