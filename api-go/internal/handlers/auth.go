package handlers

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/innovatek/minicluster/internal/auth"
	mw "github.com/innovatek/minicluster/internal/middleware"
)

type AuthHandler struct {
	svc *auth.Service
}

func NewAuthHandler(svc *auth.Service) *AuthHandler {
	return &AuthHandler{svc: svc}
}

func (h *AuthHandler) Routes(authMW func(http.Handler) http.Handler) chi.Router {
	r := chi.NewRouter()
	r.Post("/login", h.login)
	r.Post("/refresh", h.refresh)
	r.Group(func(r chi.Router) {
		r.Use(authMW)
		r.Post("/logout", h.logout)
		r.Get("/me", h.me)
		r.Post("/change-password", h.changePassword)
		r.Get("/users", h.listUsers)
		r.Post("/users", h.createUser)
		r.Put("/users/{id}", h.updateUser)
		r.Delete("/users/{id}", h.deleteUser)
	})
	return r
}

func (h *AuthHandler) login(w http.ResponseWriter, r *http.Request) {
	var req auth.LoginRequest
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	result, err := h.svc.Login(req)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if !result.Success {
		writeJSON(w, http.StatusUnauthorized, result)
		return
	}
	// Set refresh token as HttpOnly cookie
	http.SetCookie(w, &http.Cookie{
		Name:     "refreshToken",
		Value:    result.RefreshToken,
		HttpOnly: true,
		Path:     "/api/auth/refresh",
		SameSite: http.SameSiteStrictMode,
	})
	writeJSON(w, http.StatusOK, result)
}

func (h *AuthHandler) refresh(w http.ResponseWriter, r *http.Request) {
	// try cookie first, then body
	tokenStr := ""
	if cookie, err := r.Cookie("refreshToken"); err == nil {
		tokenStr = cookie.Value
	} else {
		var req auth.RefreshRequest
		if err := readJSON(r, &req); err == nil {
			tokenStr = req.RefreshToken
		}
	}

	if tokenStr == "" {
		writeError(w, http.StatusBadRequest, "refresh token required")
		return
	}

	result, err := h.svc.RefreshToken(tokenStr)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if !result.Success {
		writeJSON(w, http.StatusUnauthorized, result)
		return
	}
	http.SetCookie(w, &http.Cookie{
		Name:     "refreshToken",
		Value:    result.RefreshToken,
		HttpOnly: true,
		Path:     "/api/auth/refresh",
		SameSite: http.SameSiteStrictMode,
	})
	writeJSON(w, http.StatusOK, result)
}

func (h *AuthHandler) logout(w http.ResponseWriter, r *http.Request) {
	tokenStr := ""
	if cookie, err := r.Cookie("refreshToken"); err == nil {
		tokenStr = cookie.Value
	} else {
		var req auth.RefreshRequest
		if err := readJSON(r, &req); err == nil {
			tokenStr = req.RefreshToken
		}
	}
	if tokenStr != "" {
		h.svc.RevokeToken(tokenStr)
	}
	http.SetCookie(w, &http.Cookie{
		Name:     "refreshToken",
		Value:    "",
		MaxAge:   -1,
		Path:     "/api/auth/refresh",
		HttpOnly: true,
	})
	writeJSON(w, http.StatusOK, map[string]string{"message": "logged out"})
}

func (h *AuthHandler) me(w http.ResponseWriter, r *http.Request) {
	claims := mw.GetClaims(r)
	dto, err := h.svc.GetUserByID(claims.UserID)
	if err != nil {
		if isNotFound(err) {
			notFound(w)
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, dto)
}

func (h *AuthHandler) changePassword(w http.ResponseWriter, r *http.Request) {
	claims := mw.GetClaims(r)
	var req auth.ChangePasswordRequest
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if err := h.svc.ChangePassword(claims.UserID, req.CurrentPassword, req.NewPassword); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "password changed"})
}

func (h *AuthHandler) listUsers(w http.ResponseWriter, r *http.Request) {
	users, err := h.svc.GetAllUsers()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, users)
}

func (h *AuthHandler) createUser(w http.ResponseWriter, r *http.Request) {
	var req auth.CreateUserRequest
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	user, err := h.svc.CreateUser(req)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, user)
}

func (h *AuthHandler) updateUser(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req auth.UpdateUserRequest
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	user, err := h.svc.UpdateUser(id, req)
	if err != nil {
		if isNotFound(err) {
			notFound(w)
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, user)
}

func (h *AuthHandler) deleteUser(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := h.svc.DeleteUser(id); err != nil {
		if isNotFound(err) {
			notFound(w)
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
