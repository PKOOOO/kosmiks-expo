import { Client, Databases, Storage } from "react-native-appwrite";

// Appwrite configuration - only database and storage functionality
// Authentication has been migrated to Clerk
export const appwriteConfig = {
    endpoint: process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT!,
    projectId: process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID!,
    platform: "com.servey.app",
    databaseId: '68fa82b2003362e4285e',
    bucketId: '68643e170015edaa95d7',
    userCollectionId: 'user',
}

export const client = new Client();

client
    .setEndpoint(appwriteConfig.endpoint)
    .setProject(appwriteConfig.projectId)
    .setPlatform(appwriteConfig.platform)

export const databases = new Databases(client);
export const storage = new Storage(client);
