import { pollForToken, startDeviceCodeFlow } from "../deviceCode";
import { refreshAccessToken } from "../refresh";
import type { AuthStrategy, LoginArgs } from "../strategy";
import type { StoredTokens } from "../tokenStore";

export class DeviceCodeStrategy implements AuthStrategy {
	async login({ onState, signal }: LoginArgs): Promise<StoredTokens> {
		onState({ phase: "starting" });
		const device = await startDeviceCodeFlow();
		onState({
			phase: "device-code",
			userCode: device.userCode,
			verificationUri: device.verificationUri,
			message: device.message,
		});
		return pollForToken(device, { signal });
	}

	refresh(current: StoredTokens): Promise<StoredTokens> {
		return refreshAccessToken(current);
	}
}
