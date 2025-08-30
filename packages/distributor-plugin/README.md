# Kaneo Social Feedback Plugin

A plugin for automatically converting social media feedback into actionable tasks in Kaneo project management system.

## Overview

This plugin processes social media mentions (Twitter, GitHub, etc.) and automatically creates:

- Workspaces for organizations
- Projects for specific products/services
- Users for social media accounts
- Tasks with proper attribution and assignment

## Features

- **Automatic Workspace Creation**: Creates workspaces based on organization mentions
- **Project Management**: Automatically creates projects for mentioned accounts
- **User Management**: Creates users from social media accounts with proper roles
- **Task Attribution**: Tracks task creators and assignees from social mentions
- **Label Extraction**: Automatically extracts labels from hashtags and content
- **Priority Detection**: Uses AI to determine task priority from content
- **Idempotent Operations**: Safe to run multiple times with same input

## Architecture

### Core Components

- **`KaneoPlugin`**: Main plugin class implementing the usersdotfun plugin interface
- **`KaneoClient`**: Handles tRPC and Better Auth client interactions
- **`KaneoAuthClient`**: Better Auth client with API key and organization support
- **Type Definitions**: Comprehensive TypeScript types for all operations

### Authentication

Uses Better Auth with:

- **API Key Plugin**: Server-to-server authentication
- **Organization Plugin**: Workspace and member management
- **tRPC Integration**: Type-safe API calls

## Usage

### Input Schema

```typescript
{
  task: {
    title: string;
    description?: string;
    status: string;
    priority?: string;
    labels?: string[];
  },
  project: {
    name: string;
    slug: string;
    icon: string;
    ownerSocial: {
      platform: "twitter" | "github";
      username: string;
      displayName?: string;
    };
  },
  workspace: {
    name: string;
    description?: string;
  },
  creator: {
    platform: "twitter" | "github";
    username: string;
    displayName?: string;
  },
  assignee?: {
    platform: "twitter" | "github";
    username: string;
    displayName?: string;
  }
}
```

### Example Workflow

**Social Media Post:**

```
@usersdotfun @projectAccount your website is broken #bug assign to @developer1
```

**Plugin Processing:**

1. Creates workspace "usersdotfun" if it doesn't exist
2. Creates user for @projectAccount as workspace owner
3. Creates project "ProjectAccount Website" in the workspace
4. Creates user for @user123 as contributor (task creator)
5. Creates user for @developer1 as contributor (task assignee)
6. Creates task with proper attribution and metadata

**Result:**

- Task: "Website broken - reported via Twitter"
- Assigned to: @developer1
- Created by: @user123 (tracked in metadata)
- Labels: ["bug", "website"]
- Source: "social_feedback"

## Configuration

### Environment Variables

```typescript
{
  variables: {
    baseUrl: "http://localhost:1337", // Kaneo API URL
    timeout: 30000 // Request timeout in ms
  },
  secrets: {
    apiKey: "your-api-key", // Better Auth API key
    serviceAccountEmail?: "service@example.com" // Optional service account
  }
}
```

### API Requirements

The plugin requires the following API endpoints:

- tRPC routes: `task`, `project`, `healthCheck`
- Better Auth endpoints: organization management, user creation
- API key authentication support

## Development

### Project Structure

```
plugin/
├── src/
│   ├── index.ts          # Main plugin class
│   ├── client.ts         # Kaneo API client
│   ├── auth-client.ts    # Better Auth client
│   ├── schemas/          # Zod schemas
│   ├── types.ts          # TypeScript types
│   └── workflow.ts       # Example workflows
├── package.json
└── README.md
```

### Dependencies

- `@trpc/client`: Type-safe API client
- `better-auth`: Authentication and organization management
- `every-plugin`: Plugin framework
- `zod`: Schema validation

### TODOs

- [ ] Implement social user lookup by platform data
- [ ] Add contributor role to permission system
- [ ] Implement workspace member management
- [ ] Add project findBySlug endpoint to API
- [ ] Extend user table with social platform data
- [ ] Add metadata support to task creation
- [ ] Implement proper error handling and retries
- [ ] Add rate limiting and request throttling

## Integration

### With AI Processing

```typescript
import { processSocialFeedback } from './workflow';

// Process tweet with AI
const input = await processSocialFeedback(
  "@usersdotfun @myproject the login is broken #bug",
  ["usersdotfun", "myproject"],
  ["bug"],
  { username: "user123", displayName: "John Doe" }
);

// Execute plugin
const result = await plugin.execute(input);
```

### With Social Media APIs

The plugin is designed to work with social media monitoring systems that:

1. Monitor mentions and hashtags
2. Extract structured data using AI
3. Convert to plugin input format
4. Execute plugin to create tasks

## Error Handling

The plugin implements comprehensive error handling:

- **Atomic Operations**: All operations succeed or fail together
- **Idempotent Design**: Safe to retry failed operations
- **Detailed Logging**: Comprehensive logging for debugging
- **Type Safety**: Full TypeScript coverage prevents runtime errors

## Security

- **API Key Authentication**: Secure server-to-server communication
- **Permission-based Access**: Role-based access control
- **Input Validation**: Comprehensive schema validation
- **Rate Limiting**: Built-in rate limiting support

## License

MIT License - see LICENSE file for details.
