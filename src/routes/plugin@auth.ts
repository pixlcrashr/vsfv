import { QwikAuth$ } from "@auth/qwik";
import type { Provider } from "@auth/core/providers";
import { Prisma } from "~/lib/prisma";

export const { onRequest, useSession, useSignIn, useSignOut } = QwikAuth$(
  (req) => ({
    providers: [
      {
        id: "gitlab",
        name: "GitLab",
        type: "oidc",
        issuer: req.env.get("GITLAB_ISSUER")!,
        clientId: req.env.get("GITLAB_CLIENT_ID")!,
        clientSecret: req.env.get("GITLAB_CLIENT_SECRET")!,
        authorization: {
          params: {
            scope: "openid profile email read_user",
          },
        },
        profile(profile) {
          return {
            id: profile.sub,
            name: profile.name || profile.nickname,
            email: profile.email,
            image: profile.picture || profile.avatar_url,
          };
        },
      } as Provider,
    ],
    secret: req.env.get("AUTH_SECRET")!,
    callbacks: {
      async signIn({ user, account, profile }) {
        if (!user.email || !user.id) {
          return false;
        }

        try {
          const existingUser = await Prisma.users.findUnique({
            where: { email: user.email },
          });

          if (!existingUser) {
            const newUser = await Prisma.users.create({
              data: {
                email: user.email,
                name: user.name || user.email,
                picture: user.image,
              },
            });

            if (account) {
              await Prisma.user_identities.create({
                data: {
                  user_id: newUser.id,
                  provider: account.provider,
                  provider_user_id: account.providerAccountId,
                },
              });
            }
          } else {
            if (account) {
              const existingIdentity = await Prisma.user_identities.findUnique({
                where: {
                  provider_provider_user_id: {
                    provider: account.provider,
                    provider_user_id: account.providerAccountId,
                  },
                },
              });

              if (!existingIdentity) {
                await Prisma.user_identities.create({
                  data: {
                    user_id: existingUser.id,
                    provider: account.provider,
                    provider_user_id: account.providerAccountId,
                  },
                });
              }
            }
          }

          return true;
        } catch (error) {
          console.error("Error during sign in:", error);
          return false;
        }
      },
      async jwt({ token, user, account, profile }) {
        if (user?.email) {
          const dbUser = await Prisma.users.findUnique({
            where: { email: user.email },
          });

          if (dbUser) {
            token.sub = dbUser.id;
            token.email = dbUser.email;
            token.name = dbUser.name;
            token.picture = dbUser.picture;
          }
        }

        return token;
      },
      async session({ session, token }) {
        if (token.sub) {
          session.user.id = token.sub;
        }
        if (token.email) {
          session.user.email = token.email;
        }
        if (token.name) {
          session.user.name = token.name;
        }
        if (token.picture) {
          session.user.image = token.picture;
        }

        return session;
      },
    },
  }),
);
