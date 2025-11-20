import React, { useState, useContext, ChangeEvent, useCallback } from 'react';
import { AuthContext } from '@/contexts/AuthContext';
import { UserProfile } from '../types';
import { processImageForGemini } from '@/utils/fileUtils';
import { ChevronLeftIcon, UploadIcon, XIcon, UserProfileIcon } from './Icons';
import PageHeader from './PageHeader';

const ProfileInput: React.FC<{
    label: string;
    id: keyof UserProfile;
    value: string | number | undefined;
    onChange: (e: ChangeEvent<HTMLInputElement>) => void;
    type?: string;
    placeholder?: string;
}> = ({ label, id, value, onChange, type = 'text', placeholder }) => (
    <div>
        <label htmlFor={id} className="block text-sm font-medium text-slate-700 mb-1 ml-4">{label}</label>
        <input
            type={type}
            id={id}
            name={id}
            value={value || ''}
            onChange={onChange}
            placeholder={placeholder}
            className="form-input"
        />
    </div>
);

const ImagePicker: React.FC<{ onFileSelect: (base64: string) => void, currentImage: string | undefined }> = ({ onFileSelect, currentImage }) => {
    
    const handleFileChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            try {
                const { base64 } = await processImageForGemini(file);
                onFileSelect(`data:image/jpeg;base64,${base64}`);
            } catch (error) {
                console.error("Error processing profile image:", error);
            }
        }
    }, [onFileSelect]);
    
    return (
        <div className="flex flex-col items-center gap-4">
            {currentImage ? (
                <img src={currentImage} alt="Profile" className="w-32 h-32 rounded-full object-cover border-4 border-white shadow-md" />
            ) : (
                <div className="w-32 h-32 rounded-full bg-slate-200 flex items-center justify-center text-slate-400">
                    <UploadIcon className="w-12 h-12" />
                </div>
            )}
            <label htmlFor="profile-picture-upload" className="btn btn-secondary cursor-pointer">
                {currentImage ? 'Change Photo' : 'Upload Photo'}
                <input id="profile-picture-upload" type="file" accept="image/*" className="sr-only" onChange={handleFileChange} />
            </label>
        </div>
    );
};

export const ProfilePage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const { user, updateUserProfile } = useContext(AuthContext);
    const [profile, setProfile] = useState<UserProfile>(user!);

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        const { name, value, type } = e.target;
        setProfile(prev => ({
            ...prev,
            [name]: type === 'number' ? (value === '' ? undefined : parseInt(value, 10)) : value
        }));
    };
    
    const handleImageChange = (base64: string) => {
        setProfile(prev => ({ ...prev, picture: base64 }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        updateUserProfile(profile);
        alert('Profile updated successfully!');
        onBack();
    };

    if (!user) return null;

    return (
        <div className="max-w-4xl mx-auto animate-fade-in">
            <PageHeader
                className="mb-8"
                title="Profile"
                subtitle={<span className="text-xs md:text-sm">Manage your account and preferences</span>}
                icon={<UserProfileIcon className="w-full h-full" />}
                actions={
                    <button onClick={onBack} className="btn btn-secondary inline-flex items-center gap-2">
                        <ChevronLeftIcon className="w-5 h-5" />
                        Back to Dashboard
                    </button>
                }
            />
            <div className="card">
                <form onSubmit={handleSubmit}>
                    <div className="p-8 space-y-8">
                        <div className="flex flex-col md:flex-row items-center gap-8">
                             <ImagePicker onFileSelect={handleImageChange} currentImage={profile.picture} />
                             <div className="flex-grow w-full space-y-4">
                                <ProfileInput
                                    label="Full Name"
                                    id="name"
                                    value={profile.name}
                                    onChange={handleChange}
                                    placeholder="Your full name"
                                />
                                <ProfileInput
                                    label="Company / Institute"
                                    id="company"
                                    value={profile.company}
                                    onChange={handleChange}
                                    placeholder="e.g., Acme Corp / University of Design"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                             <ProfileInput
                                label="Age"
                                id="age"
                                type="number"
                                value={profile.age}
                                onChange={handleChange}
                                placeholder="Your age"
                            />
                            <ProfileInput
                                label="Location"
                                id="location"
                                value={profile.location}
                                onChange={handleChange}
                                placeholder="e.g., City, Country"
                            />
                             <ProfileInput
                                label="Favorite Animal"
                                id="favoriteAnimal"
                                value={profile.favoriteAnimal}
                                onChange={handleChange}
                                placeholder="e.g., Capybara"
                            />
                        </div>
                    </div>
                    <div className="bg-slate-50 px-8 py-4 border-t border-slate-200 flex justify-end rounded-b-lg">
                        <button type="submit" className="btn btn-primary btn-large">
                            Save Changes
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
