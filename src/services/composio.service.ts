import { Composio, ComposioToolSet, type ActionExecuteResponse } from 'composio-core';

export type RawActionData = Awaited<ReturnType<ComposioToolSet['getToolsSchema']>>[number];

/**
 * Service to interact with Composio for tools management
 * Handles listing available tools and executing them
 */
class ComposioService {
	private toolset: ComposioToolSet | null = null;
	private composio: Composio | null = null;

	private getToolSet(): ComposioToolSet {
		if (!this.toolset) {
			const apiKey = process.env.COMPOSIO_API_KEY;
			if (!apiKey) {
				throw new Error('COMPOSIO_API_KEY is not set');
			}

			this.toolset = new ComposioToolSet({
				apiKey,
				entityId: 'default',
			});
		}
		return this.toolset;
	}

	private getClient(): Composio {
		if (!this.composio) {
			const apiKey = process.env.COMPOSIO_API_KEY;
			if (!apiKey) {
				throw new Error('COMPOSIO_API_KEY is not set');
			}

			this.composio = new Composio({ apiKey });
		}
		return this.composio;
	}

	/**
	 * Get all available tools/actions from connected apps
	 */
	async getTools(entityId = 'default'): Promise<RawActionData[]> {
		const toolset = this.getToolSet();

		// Get tools schema with no filter (all connected apps)
		const tools = await toolset.getToolsSchema({}, entityId);
		return tools;
	}

	/**
	 * Get tools for specific apps only
	 */
	async getToolsForApps(apps: string[], entityId = 'default'): Promise<RawActionData[]> {
		const toolset = this.getToolSet();

		const tools = await toolset.getToolsSchema({ apps }, entityId);
		return tools;
	}

	/**
	 * Execute a tool/action with given parameters
	 */
	async executeTool(
		action: string,
		params: Record<string, unknown>,
		entityId = 'default',
	): Promise<ActionExecuteResponse> {
		const toolset = this.getToolSet();

		const result = await toolset.executeAction({
			action,
			params,
			entityId,
		});

		return result;
	}

	/**
	 * List all connected accounts for an entity
	 */
	async listConnections(entityId = 'default') {
		const client = this.getClient();
		const entity = client.getEntity(entityId);

		const connections = await entity.getConnections();
		return connections;
	}

	/**
	 * Get connection status for an app
	 */
	async getConnectionStatus(appName: string, entityId = 'default') {
		const client = this.getClient();
		const entity = client.getEntity(entityId);

		try {
			const connection = await entity.getConnection({ appName });
			return { connected: true, connection };
		} catch {
			return { connected: false, connection: null };
		}
	}

	/**
	 * Initiate OAuth connection for an app
	 */
	async initiateConnection(appName: string, redirectUrl: string, entityId = 'default') {
		const client = this.getClient();
		const entity = client.getEntity(entityId);

		const connection = await entity.initiateConnection({
			appName,
			config: { redirectUrl },
		});

		return connection;
	}
}

export const composioService = new ComposioService();
