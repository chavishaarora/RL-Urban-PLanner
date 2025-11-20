import React, { useContext, useEffect, useRef, useState } from 'react';
import { AuthContext } from '@/contexts/AuthContext';
import { UserProfile } from '../types';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

declare const google: any;

const decodeJwtResponse = (token: string): any => {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));

        return JSON.parse(jsonPayload);
    } catch (error) {
        console.error("Error decoding JWT", error);
        return null;
    }
}

export const LoginScreen: React.FC = () => {
    const { login } = useContext(AuthContext);
    const signInButtonRef = useRef<HTMLDivElement>(null);
    const [username, setUsername] = useState('');

    const handleCredentialResponse = (response: any) => {
        const credential = response.credential;
        if (credential) {
            const decodedToken = decodeJwtResponse(credential);
            if (decodedToken) {
                const userProfile: UserProfile = {
                    id: decodedToken.sub,
                    name: decodedToken.given_name || decodedToken.name,
                    picture: decodedToken.picture,
                };
                login(userProfile);
            } else {
                console.error("Failed to decode JWT token.");
            }
        }
    };

    const handleGuestLogin = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedUsername = username.trim();
        if (trimmedUsername) {
            try {
                console.log("Creating guest profile for:", trimmedUsername);
                const guestProfile: UserProfile = {
                    id: `guest-${trimmedUsername.toLowerCase().replace(/\s+/g, '-')}`,
                    name: trimmedUsername,
                };
                console.log("Guest profile created:", guestProfile);
                login(guestProfile);
                console.log("Login function called");
            } catch (error) {
                console.error("Error during guest login:", error);
                alert("Failed to log in as guest. Please try again.");
            }
        }
    };

    useEffect(() => {
        const loadGoogleSignIn = () => {
            if (!signInButtonRef.current) return;
            
            if (typeof google === 'undefined' || !google.accounts) {
                // If Google API is not loaded yet, retry after a short delay
                setTimeout(loadGoogleSignIn, 100);
                return;
            }

            try {
                google.accounts.id.initialize({
                    client_id: GOOGLE_CLIENT_ID,
                    callback: handleCredentialResponse,
                    use_fedcm_for_prompt: false,
                    auto_select: false,
                    cancel_on_tap_outside: true,
                    context: 'signin',
                    ux_mode: 'popup',
                    allowed_parent_origin: [window.location.origin],
                });

                google.accounts.id.renderButton(
                    signInButtonRef.current,
                    { 
                        type: "standard",
                        theme: "outline", 
                        size: "large", 
                        text: "continue_with",
                        shape: "pill",
                        width: signInButtonRef.current.offsetWidth,
                        logo_alignment: "center"
                    }
                );

                // Only prompt if we're on a secure context
                if (window.isSecureContext) {
                    google.accounts.id.prompt();
                }
            } catch (error) {
                console.error("Error initializing Google Sign-In:", error);
                // Show error message to user
                const errorDiv = document.createElement('div');
                errorDiv.className = 'text-red-500 text-sm mt-2 text-center';
                errorDiv.textContent = 'Failed to initialize Google Sign-In. Please try the guest login option.';
                signInButtonRef.current.parentElement?.appendChild(errorDiv);
            }
        };

        loadGoogleSignIn();

        // Cleanup function
        return () => {
            if (typeof google !== 'undefined' && google.accounts) {
                try {
                    google.accounts.id.cancel();
                } catch (error) {
                    console.error("Error cleaning up Google Sign-In:", error);
                }
            }
        };
    }, []);


    return (
        <div className="flex items-center justify-center min-h-screen bg-slate-50 p-4">
            <div className="card w-full max-w-md p-8 space-y-6">
                <div className="text-center">
                    <h1 className="text-4xl font-extrabold tracking-tight text-slate-800 mb-2">
                        Urban<span className="text-teal-500">Eyes</span>
                    </h1>
                    <p className="mt-2 text-slate-600">We got our eyes on your site, you design</p>
                </div>
                
                <div className="flex flex-col items-center justify-center space-y-4">
                    <div ref={signInButtonRef} id="signInDiv"></div>
                    {GOOGLE_CLIENT_ID.startsWith('YOUR_') && (
                        <p className="mt-4 text-xs text-amber-600 bg-amber-50 p-3 rounded-md text-center">
                            <strong>Developer Note:</strong> Google Sign-In is not configured. Please add your Google Client ID in <code>components/LoginScreen.tsx</code> to enable login.
                        </p>
                    )}
                </div>

                <div className="relative flex py-2 items-center">
                    <div className="flex-grow border-t border-slate-200"></div>
                    <span className="flex-shrink mx-4 text-sm text-slate-400">OR</span>
                    <div className="flex-grow border-t border-slate-200"></div>
                </div>
                
                <form onSubmit={handleGuestLogin} className="space-y-4">
                    <div>
                        <label htmlFor="username" className="block text-sm font-medium text-slate-700 ml-4">Continue as a guest</label>
                        <input
                            id="username"
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Enter your name"
                            className="mt-1 block w-full form-input"
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={!username.trim()}
                        className="w-full btn btn-primary"
                    >
                        Continue
                    </button>
                </form>

            </div>
        </div>
    );
};