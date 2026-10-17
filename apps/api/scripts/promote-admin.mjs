import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = process.argv
    .slice(2)
    .find((arg) => arg.startsWith('--email='))
    ?.slice('--email='.length)
    .trim()
    .toLowerCase();

  if (!email) {
    console.error('Uso: pnpm admin:promote --email=usuario@exemplo.com');
    process.exitCode = 1;
    return;
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      role: true,
    },
  });

  if (!user) {
    console.error('Usuário não encontrado.');
    process.exitCode = 1;
    return;
  }

  if (user.role === UserRole.ADMIN) {
    console.log('Este usuário já é administrador.');
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { role: UserRole.ADMIN },
  });

  console.log('Permissão administrativa concedida com sucesso.');
}

try {
  await main();
} catch (error) {
  console.error('Falha ao atualizar a permissão administrativa.');
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
