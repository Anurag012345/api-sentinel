const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

/**
 * Get stored auth token from localStorage.
 */
function getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('api_sentinel_token');
}

/**
 * Store auth token in localStorage.
 */
export function setToken(token: string): void {
    localStorage.setItem('api_sentinel_token', token);
}

/**
 * Remove auth token from localStorage.
 */
export function removeToken(): void {
    localStorage.removeItem('api_sentinel_token');
}

/**
 * Check if user is authenticated.
 */
export function isAuthenticated(): boolean {
    return !!getToken();
}

/**
 * Make an authenticated API request.
 */
async function apiFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const token = getToken();

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string> || {}),
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
    });

    // Auto-logout on 401
    if (response.status === 401) {
        removeToken();
        if (typeof window !== 'undefined') {
            window.location.href = '/login';
        }
    }

    return response;
}

// ============================================================
// Auth API
// ============================================================

export async function register(email: string, password: string) {
    const res = await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
    });
    return res.json();
}

export async function login(email: string, password: string) {
    const res = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
    });
    return res.json();
}

// ============================================================
// User API
// ============================================================

export async function saveApiKey(apiKey: string) {
    const res = await apiFetch('/user/api-key', {
        method: 'POST',
        body: JSON.stringify({ apiKey }),
    });
    return res.json();
}

export async function setBudget(dailyLimit: number) {
    const res = await apiFetch('/user/budget', {
        method: 'POST',
        body: JSON.stringify({ dailyLimit }),
    });
    return res.json();
}

export async function reactivateAccount() {
    const res = await apiFetch('/user/reactivate', {
        method: 'POST',
    });
    return res.json();
}

// ============================================================
// Dashboard API
// ============================================================

export async function getDashboard() {
    const res = await apiFetch('/dashboard');
    return res.json();
}
