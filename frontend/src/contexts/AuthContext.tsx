import React, { createContext, ReactNode, useState, useEffect } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { UserProfile } from '../types';

declare const google: any;

const GOOGLE_CLIENT_ID = "717733653864-rjgpergv53v5p96ral73msga2ojui691.apps.googleusercontent.com";

interface AuthContextType {
    user: UserProfile | null;
    login: (profile: UserProfile) => void;
    logout: () => void;
    updateUserProfile: (updatedProfile: Partial<UserProfile>) => void;
}

export const AuthContext = createContext<AuthContextType>({
    user: null,
    login: () => {},
    logout: () => {},
    updateUserProfile: () => {},
});

interface AuthProviderProps {
    children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [user, setUser] = useLocalStorage<UserProfile | null>('urban-eyes-user-profile', null);
    
    // Force a re-render when user state changes
    const [, forceUpdate] = useState({});

    const login = (profile: UserProfile) => {
        try {
            console.log("AuthProvider: Login called with profile:", profile);
            
            // Validate profile data
            if (!profile.id || !profile.name) {
                console.error("Invalid profile data:", profile);
                throw new Error("Invalid profile data");
            }

            // When a user logs in, check if they have an extended profile saved
            const extendedProfileKey = `urban-eyes-profile-${profile.id}`;
            let savedExtendedProfile = null;
            
            try {
                const savedData = localStorage.getItem(extendedProfileKey);
                if (savedData) {
                    savedExtendedProfile = JSON.parse(savedData);
                }
            } catch (e) {
                console.warn("Failed to load extended profile:", e);
            }

            const finalProfile = savedExtendedProfile 
                ? { ...profile, ...savedExtendedProfile }
                : profile;

            console.log("Setting user profile:", finalProfile);
            setUser(finalProfile);
            
            // Force a re-render to ensure state is updated
            forceUpdate({});
            
            console.log("Login completed successfully");
        } catch (error) {
            console.error("Error in login function:", error);
            throw error;
        }
    };

    const logout = () => {
        // Log out from Google account to prevent auto-login on next visit
        if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
            google.accounts.id.disableAutoSelect();
        }
        setUser(null);
    };

    const updateUserProfile = (updatedProfile: Partial<UserProfile>) => {
        if (user) {
            const newProfile = { ...user, ...updatedProfile };
            setUser(newProfile);
            
            // Save the extended profile data separately so it persists across logins
            const extendedProfileKey = `urban-eyes-profile-${user.id}`;
            localStorage.setItem(extendedProfileKey, JSON.stringify(newProfile));
        }
    };
    
    return (
        <AuthContext.Provider value={{ user, login, logout, updateUserProfile }}>
            {children}
        </AuthContext.Provider>
    );
};