import { newEnforcer, Enforcer } from 'casbin';
import { PrismaAdapter } from './prisma-adapter';
import { join } from 'path';

let enforcer: Enforcer | null = null;

export async function getEnforcer(): Promise<Enforcer> {
  if (!enforcer) {
    const adapter = new PrismaAdapter();
    const modelPath = join(process.cwd(), 'src', 'lib', 'auth', 'casbin-model.conf');
    enforcer = await newEnforcer(modelPath, adapter);
    await enforcer.loadPolicy();
  }
  return enforcer;
}

export async function reloadPolicies(): Promise<void> {
  if (enforcer) {
    await enforcer.loadPolicy();
  }
}
