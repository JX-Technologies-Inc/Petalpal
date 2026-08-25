import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcrypt";
import { createHash } from "crypto";

import prisma from "./lib/prisma.js";
import flowerDB from "./data/flowerDB.js";
import { predictMood, loadMoodModel } from "./moodClassifier.js";
import http from "http";
import { Server } from "socket.io";
import {
  authenticateRequest,
  authenticateSocket,
  createAccessToken,
  requireOwnUser
} from "./lib/auth.js";
import { verifyFirebaseIdToken } from "./lib/firebase-auth.js";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

io.use(authenticateSocket);

//ROS
io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);
  
    socket.on("join-user", () => {
      const normalizedUserId = String(socket.data.currentUserId);

      if (
        socket.data.currentUserId &&
        socket.data.currentUserId !==
          normalizedUserId
      ) {
        socket.leave(
          `user:${socket.data.currentUserId}`
        );
      }

      socket.data.currentUserId =
        normalizedUserId;

      socket.join(
        `user:${normalizedUserId}`
      );

      console.log(
        `${socket.id} joined user:${normalizedUserId}`
      );
    });

    socket.on("leave-user", () => {
      const normalizedUserId = String(socket.data.currentUserId);

      socket.leave(
        `user:${normalizedUserId}`
      );

      console.log(
        `${socket.id} left user:${normalizedUserId}`
      );
    });

    socket.on("join-garden", (gardenOwnerId) => {
      if (!gardenOwnerId) return;
  
      if (socket.data.currentGarden) {
        socket.leave(`garden:${socket.data.currentGarden}`);
      }
  
      socket.data.currentGarden = gardenOwnerId;
  
      socket.join(`garden:${gardenOwnerId}`);
  
      console.log(
        `${socket.id} joined garden:${gardenOwnerId}`
      );
    });
    socket.on("move-avatar", async (data) => {
        const {
          gardenOwnerId,
          x,
          y
        } = data || {};

        const visitorId = String(socket.data.currentUserId);
      
        if (
          !gardenOwnerId ||
          typeof x !== "number" ||
          typeof y !== "number"
        ) {
          return;
        }
      
        const visitor = await prisma.user.findUnique({
          where: { id: visitorId },
          select: { name: true, avatar: true }
        });

        if (!visitor) return;

        io.to(`garden:${gardenOwnerId}`).emit(
          "avatarMoved",
          {
            visitorId,
            userId: visitorId,
            gardenOwnerId,
            ownerId: gardenOwnerId,
            name: visitor.name,
            avatar: visitor.avatar,
            x,
            y
          }
        );
      });
  
    socket.on("disconnect", () => {
      console.log("Socket disconnected:", socket.id);
    });
  });


app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const activeVisitorsByGarden = {};
 
function getActiveVisitors(gardenId) {
  return activeVisitorsByGarden[gardenId] || [];
}

function setActiveVisitors(gardenId, visitors) {
  activeVisitorsByGarden[gardenId] = visitors;
}

const AI_TERMS_VERSION = "2026-08-25";
const REPORT_CATEGORIES = new Set([
  "HARASSMENT",
  "HATE_SPEECH",
  "SELF_HARM",
  "SPAM",
  "PRIVACY",
  "OTHER"
]);
const FAIRY_STEPS = new Set([
  "EMPTY_GARDEN",
  "FAIRY_APPEARS",
  "MOOD_SELECTION",
  "PLANT_FIRST_FLOWER",
  "FLOWER_BLOOM",
  "GARDEN_UNLOCKED"
]);

function normalizeTimezone(value) {
  const timezone =
    typeof value === "string" && value.trim()
      ? value.trim()
      : "UTC";

  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format();
    return timezone;
  } catch {
    return null;
  }
}

function getLocalDate(timezone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts.map(({ type, value }) => [type, value])
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function hashAiInput(text) {
  return createHash("sha256").update(text).digest("hex");
}

async function getUser(userId) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: {
      garden: {
        include: {
          flowers: {
            include: {
              messages: true,
            },
            orderBy: {
              createdAt: "desc",
            },
          },
          visitRecords: {
            orderBy: {
              createdAt: "desc",
            },
            take: 30,
          },
        },
      },
    },
  });
}

async function ensureGarden(userId) {
  let garden = await prisma.garden.findUnique({
    where: { ownerId: userId },
  });

  if (!garden) {
    garden = await prisma.garden.create({
      data: {
        ownerId: userId,
        year: new Date().getFullYear(),
      },
    });
  }

  return garden;
}
function getNonOverlappingPosition(existingFlowers) {
    const gardenWidth = 700;
    const flowerWidth = 100;
    const grassStart = 520;
    const grassEnd = 640;
  
    let left = 0;
    let top = 0;
    let tries = 0;
    let overlapping = true;
  
    while (overlapping && tries < 100) {
      left = Math.random() * (gardenWidth - flowerWidth);
      top = grassStart + Math.random() * (grassEnd - grassStart);
  
      overlapping = existingFlowers.some((flower) => {
        const flowerLeft = Number(flower.left);
        const flowerTop = Number(flower.top);
  
        return (
          Math.abs(left - flowerLeft) < 90 &&
          Math.abs(top - flowerTop) < 90
        );
      });
  
      tries += 1;
    }
  
    return { left, top };
  }
  

async function getGardenResponse(userId) {
  const user = await getUser(userId);

  if (!user) {
    return null;
  }

  const garden = user.garden || (await ensureGarden(user.id));

  const fullGarden = await prisma.garden.findUnique({
    where: { id: garden.id },
    include: {
      flowers: {
        include: {
          messages: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      },
      visitRecords: {
        orderBy: {
          createdAt: "desc",
        },
        take: 30,
      },
    },
  });

  return {
    owner: {
      id: user.id,
      name: user.name,
      avatar: user.avatar,
    },
    flowers: fullGarden.flowers,
    visitRecords: fullGarden.visitRecords,
    activeVisitors: getActiveVisitors(fullGarden.id),
  };
}


app.get("/users", async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        avatar: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    res.json(users);
  } catch (err) {
    console.error("GET /users error:", err);
    res.status(500).json({ error: "Failed to get users" });
  }
});

app.get("/users/search", async (req, res) => {
    try {
      const name = (req.query.name || "").trim();
      const currentUserId = req.query.currentUserId;
  
      if (!name) {
        return res.json([]);
      }
  
      const users = await prisma.user.findMany({
        where: {
          id: {
            not: currentUserId
          },
  
          name: {
            contains: name,
            mode: "insensitive"
          }
        },
  
        select: {
          id: true,
          name: true,
          avatar: true
        },
  
        orderBy: {
          name: "asc"
        }
      });
  
      res.json(users);
  
    } catch (err) {
  
      console.error("Search user error:", err);
  
      res.status(500).json({
        error: "Failed to search users"
      });
    }
  });

app.get("/users/:userId", async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: {
        id: req.params.userId,
      },
      include: {
        friends: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      id: user.id,
      name: user.name,
      avatar: user.avatar,
      friends: user.friends.map((friendship) => friendship.friendId),
    });
  } catch (err) {
    console.error("GET /users/:userId error:", err);
    res.status(500).json({ error: "Failed to get user" });
  }
});

app.get("/users/:userId/friends", async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: {
        id: req.params.userId,
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const friendships = await prisma.friendship.findMany({
      where: {
        userId: user.id,
      },
      include: {
        friend: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
    });

    res.json(friendships.map((item) => item.friend));
  } catch (err) {
    console.error("GET /users/:userId/friends error:", err);
    res.status(500).json({ error: "Failed to get friends" });
  }
});

app.get("/users/:userId/garden", async (req, res) => {
  try {
    const gardenResponse = await getGardenResponse(req.params.userId);

    if (!gardenResponse) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(gardenResponse);
  } catch (err) {
    console.error("GET /users/:userId/garden error:", err);
    res.status(500).json({ error: "Failed to get garden" });
  }
});
app.post("/auth/firebase", async (req, res) => {
  try {
    const {
      idToken,
      name,
      avatar,
      timezone: requestedTimezone,
      aiConsent = false
    } = req.body || {};
    const firebaseUser = await verifyFirebaseIdToken(idToken);

    if (firebaseUser.email_verified !== true) {
      return res.status(403).json({
        error: "Verify your email before creating a PetalPal account"
      });
    }

    const normalizedEmail = String(firebaseUser.email).trim().toLowerCase();
    const firebaseUid = String(firebaseUser.sub);
    const timezone = normalizeTimezone(requestedTimezone) || "UTC";
    let user = await prisma.user.findFirst({
      where: {
        OR: [{ firebaseUid }, { email: normalizedEmail }]
      }
    });

    if (user) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          firebaseUid,
          email: normalizedEmail,
          emailVerifiedAt: user.emailVerifiedAt || new Date(),
          ...(name?.trim() ? { name: name.trim() } : {}),
          ...(avatar ? { avatar } : {}),
          ...(requestedTimezone ? { timezone } : {})
        }
      });
    } else {
      const now = Date.now();
      user = await prisma.user.create({
        data: {
          id: `user_${now}`,
          accountId: `PP${String(now).slice(-8)}`,
          firebaseUid,
          name: name?.trim() || normalizedEmail.split("@")[0],
          email: normalizedEmail,
          emailVerifiedAt: new Date(),
          avatar: avatar || "🦋",
          timezone,
          garden: { create: { year: new Date().getFullYear() } },
          fairyState: { create: {} },
          aiConsent: {
            create: {
              termsVersion: AI_TERMS_VERSION,
              aiProcessing: Boolean(aiConsent),
              grantedAt: aiConsent ? new Date() : null
            }
          },
          subscriptionEntitlement: { create: {} }
        }
      });
    }

    const safeUser = {
      id: user.id,
      accountId: user.accountId,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      timezone: user.timezone,
      emailVerified: Boolean(user.emailVerifiedAt)
    };

    return res.json({
      user: safeUser,
      token: createAccessToken(safeUser)
    });
  } catch (error) {
    console.error("POST /auth/firebase error:", error);
    return res.status(401).json({
      error: "Invalid Firebase session or unverified email"
    });
  }
});

app.post("/register", (_req, res) => {
  res.status(410).json({
    error: "Registration now requires Firebase email verification"
  });
});

app.post("/login", (_req, res) => {
  res.status(410).json({
    error: "Login now requires Firebase Authentication"
  });
});

app.post("/legacy-register-disabled", async (req, res) => {
    try {
      const {
        name,
        email,
        password,
        avatar,
        timezone: requestedTimezone,
        aiConsent = false
      } = req.body;
  
      if (!name || !email || !password) {
        return res.status(400).json({
          error: "Name, email and password are required"
        });
      }
  
      const normalizedEmail = email.trim().toLowerCase();
      const timezone = normalizeTimezone(requestedTimezone);

      if (!timezone) {
        return res.status(400).json({ error: "Invalid timezone" });
      }
  
      if (password.length < 6) {
        return res.status(400).json({
          error: "Password must be at least 6 characters"
        });
      }
  
      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [
            { email: normalizedEmail },
            {
              name: {
                equals: name.trim(),
                mode: "insensitive"
              }
            }
          ]
        }
      });
  
      if (existingUser) {
        return res.status(400).json({
          error: "Email or username already exists"
        });
      }
  
      const passwordHash = await bcrypt.hash(password, 12);
  
      const id = `user_${Date.now()}`;
      const accountId = `PP${Date.now().toString().slice(-8)}`;
  
      const user = await prisma.user.create({
        data: {
          id,
          accountId,
          name: name.trim(),
          email: normalizedEmail,
          passwordHash,
          avatar: avatar || "🦋",
          timezone,
          garden: {
            create: {
              year: new Date().getFullYear()
            }
          },
          fairyState: {
            create: {}
          },
          aiConsent: {
            create: {
              termsVersion: AI_TERMS_VERSION,
              aiProcessing: Boolean(aiConsent),
              grantedAt: aiConsent ? new Date() : null
            }
          },
          subscriptionEntitlement: {
            create: {}
          }
        },
        select: {
          id: true,
          accountId: true,
          name: true,
          email: true,
          avatar: true,
          timezone: true
        }
      });
  
      res.status(201).json({
        user,
        token: createAccessToken(user)
      });
    } catch (err) {
      console.error("REGISTER error:", err);
      res.status(500).json({
        error: "Failed to register"
      });
    }
  });

  app.post("/legacy-login-disabled", async (req, res) => {
    try {
      const { email, password } = req.body;
  
      if (!email || !password) {
        return res.status(400).json({
          error: "Email and password are required"
        });
      }
  
      const normalizedEmail = email.trim().toLowerCase();
  
      const user = await prisma.user.findUnique({
        where: {
          email: normalizedEmail
        }
      });
  
      if (!user || !user.passwordHash) {
        return res.status(401).json({
          error: "Invalid email or password"
        });
      }
  
      const passwordMatches = await bcrypt.compare(
        password,
        user.passwordHash
      );
      console.log("passwordMatches =", passwordMatches);
  
      if (!passwordMatches) {
        return res.status(401).json({
          error: "Invalid email or password"
        });
      }
  
      const safeUser = {
        id: user.id,
        accountId: user.accountId,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        timezone: user.timezone
      };

      res.json({
        user: safeUser,
        token: createAccessToken(safeUser)
      });
    } catch (err) {
      console.error("LOGIN error:", err);
      res.status(500).json({
        error: "Failed to log in"
      });
    }
  });
  app.use((req, res, next) => {
    const isPublicFrontendAsset =
      req.method === "GET" &&
      (req.path === "/" || Boolean(path.extname(req.path)));

    if (isPublicFrontendAsset) {
      return next();
    }

    return authenticateRequest(req, res, next);
  });

  app.put("/users/avatar", async (req, res) => {
    try {
      const { avatar } = req.body;
      const userId = req.auth.userId;
  
      const user = await prisma.user.update({
        where: {
          id: userId
        },
        data: {
          avatar
        }
      });
  
      res.json(user);
    } catch (err) {
      console.error(err);
  
      res.status(500).json({
        error: "Failed to update avatar"
      });
    }
  });

app.post("/users", (_req, res) => {
  res.status(410).json({
    error: "This endpoint has been removed. Use /register instead."
  });
});

app.get("/session", async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.auth.userId },
    select: {
      id: true,
      accountId: true,
      name: true,
      email: true,
      avatar: true,
      timezone: true
    }
  });

  if (!user) {
    return res.status(401).json({ error: "Authenticated user no longer exists" });
  }

  const timezone = normalizeTimezone(user.timezone) || "UTC";
  const localDate = getLocalDate(timezone);

  const [fairyState, todayCheckIn, garden] = await Promise.all([
    prisma.fairyState.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id }
    }),
    prisma.dailyCheckIn.findUnique({
      where: {
        userId_localDate: {
          userId: user.id,
          localDate
        }
      },
      include: {
        journal: true,
        emotionResult: true,
        flower: { include: { messages: true } }
      }
    }),
    getGardenResponse(user.id)
  ]);

  res.json({
    user,
    fairyState,
    todayCheckIn,
    hasCheckedInToday: Boolean(todayCheckIn),
    garden
  });
});

app.get("/users/:userId/check-ins", async (req, res) => {
  if (!requireOwnUser(req, res, req.params.userId)) return;

  const checkIns = await prisma.dailyCheckIn.findMany({
    where: { userId: req.auth.userId },
    include: {
      journal: true,
      emotionResult: true,
      flower: { include: { messages: true } }
    },
    orderBy: { localDate: "desc" },
    take: 366
  });

  res.json(checkIns);
});

app.get("/users/:userId/fairy-state", async (req, res) => {
  if (!requireOwnUser(req, res, req.params.userId)) return;

  const fairyState = await prisma.fairyState.upsert({
    where: { userId: req.auth.userId },
    update: {},
    create: { userId: req.auth.userId }
  });

  res.json(fairyState);
});

app.put("/users/:userId/fairy-state", async (req, res) => {
  if (!requireOwnUser(req, res, req.params.userId)) return;

  const { onboardingStep, onboardingCompleted, lastEvent, unlockedFeatures } =
    req.body;

  if (onboardingStep && !FAIRY_STEPS.has(onboardingStep)) {
    return res.status(400).json({ error: "Invalid onboarding step" });
  }

  if (unlockedFeatures && !Array.isArray(unlockedFeatures)) {
    return res.status(400).json({ error: "unlockedFeatures must be an array" });
  }

  const data = {
    ...(onboardingStep ? { onboardingStep } : {}),
    ...(typeof onboardingCompleted === "boolean"
      ? { onboardingCompleted }
      : {}),
    ...(typeof lastEvent === "string"
      ? { lastEvent: lastEvent.slice(0, 64) }
      : {}),
    ...(Array.isArray(unlockedFeatures)
      ? { unlockedFeatures: unlockedFeatures.slice(0, 50) }
      : {})
  };

  const fairyState = await prisma.fairyState.upsert({
    where: { userId: req.auth.userId },
    update: data,
    create: { userId: req.auth.userId, ...data }
  });

  res.json(fairyState);
});

app.get("/users/:userId/ai-consent", async (req, res) => {
  if (!requireOwnUser(req, res, req.params.userId)) return;

  const consent = await prisma.aiConsent.upsert({
    where: { userId: req.auth.userId },
    update: {},
    create: {
      userId: req.auth.userId,
      termsVersion: AI_TERMS_VERSION
    }
  });

  res.json(consent);
});

app.put("/users/:userId/ai-consent", async (req, res) => {
  if (!requireOwnUser(req, res, req.params.userId)) return;

  const aiProcessing = Boolean(req.body.aiProcessing);
  const personalization = aiProcessing && Boolean(req.body.personalization);
  const memoryEnabled = personalization && Boolean(req.body.memoryEnabled);
  const now = new Date();

  const consent = await prisma.aiConsent.upsert({
    where: { userId: req.auth.userId },
    update: {
      termsVersion: AI_TERMS_VERSION,
      aiProcessing,
      personalization,
      memoryEnabled,
      grantedAt: aiProcessing ? now : null,
      revokedAt: aiProcessing ? null : now
    },
    create: {
      userId: req.auth.userId,
      termsVersion: AI_TERMS_VERSION,
      aiProcessing,
      personalization,
      memoryEnabled,
      grantedAt: aiProcessing ? now : null,
      revokedAt: aiProcessing ? null : now
    }
  });

  res.json(consent);
});

app.get("/users/:userId/subscription", async (req, res) => {
  if (!requireOwnUser(req, res, req.params.userId)) return;

  const entitlement = await prisma.subscriptionEntitlement.upsert({
    where: { userId: req.auth.userId },
    update: {},
    create: { userId: req.auth.userId }
  });

  res.json(entitlement);
});

app.post("/reports", async (req, res) => {
  const { reportedUserId, messageId, category, details } = req.body;

  if (!REPORT_CATEGORIES.has(category)) {
    return res.status(400).json({ error: "Invalid report category" });
  }

  if (!reportedUserId && !messageId) {
    return res.status(400).json({
      error: "A reported user or message is required"
    });
  }

  if (reportedUserId === req.auth.userId) {
    return res.status(400).json({ error: "You cannot report yourself" });
  }

  const [reportedUser, message] = await Promise.all([
    reportedUserId
      ? prisma.user.findUnique({ where: { id: reportedUserId } })
      : Promise.resolve(null),
    messageId
      ? prisma.message.findUnique({ where: { id: messageId } })
      : Promise.resolve(null)
  ]);

  if ((reportedUserId && !reportedUser) || (messageId && !message)) {
    return res.status(404).json({ error: "Reported content was not found" });
  }

  const report = await prisma.report.create({
    data: {
      reporterId: req.auth.userId,
      reportedUserId: reportedUserId || null,
      messageId: messageId || null,
      category,
      details:
        typeof details === "string" && details.trim()
          ? details.trim().slice(0, 2000)
          : null
    }
  });

  res.status(201).json(report);
});

// =========================================================
// FRIEND REQUESTS
// =========================================================

// Send a friend request
app.post("/friends/request", async (req, res) => {
    try {
      const {
        receiverId
      } = req.body;
      const senderId = req.auth.userId;
  
      if (!senderId || !receiverId) {
        return res.status(400).json({
          error: "Sender and receiver are required"
        });
      }
  
      if (
        String(senderId) ===
        String(receiverId)
      ) {
        return res.status(400).json({
          error: "You cannot send a friend request to yourself"
        });
      }
  
      const [sender, receiver] =
        await Promise.all([
          prisma.user.findUnique({
            where: {
              id: senderId
            }
          }),
  
          prisma.user.findUnique({
            where: {
              id: receiverId
            }
          })
        ]);
  
      if (!sender || !receiver) {
        return res.status(404).json({
          error: "User not found"
        });
      }
  
      // Check whether they are already friends
      const existingFriendship =
        await prisma.friendship.findFirst({
          where: {
            OR: [
              {
                userId: senderId,
                friendId: receiverId
              },
              {
                userId: receiverId,
                friendId: senderId
              }
            ]
          }
        });
  
      if (existingFriendship) {
        return res.status(409).json({
          error: "You are already friends"
        });
      }
  
      // Check for an outgoing pending request
      const existingOutgoingRequest =
        await prisma.friendRequest.findUnique({
          where: {
            senderId_receiverId: {
              senderId,
              receiverId
            }
          }
        });
  
      if (
        existingOutgoingRequest &&
        existingOutgoingRequest.status ===
          "pending"
      ) {
        return res.status(409).json({
          error: "Friend request already sent"
        });
      }
  
      // Check whether the other user already sent a request
      const existingIncomingRequest =
        await prisma.friendRequest.findUnique({
          where: {
            senderId_receiverId: {
              senderId: receiverId,
              receiverId: senderId
            }
          }
        });
  
      if (
        existingIncomingRequest &&
        existingIncomingRequest.status ===
          "pending"
      ) {
        return res.status(409).json({
          error:
            "This user has already sent you a friend request. Check your incoming requests."
        });
      }
  
      let friendRequest;
  
      if (existingOutgoingRequest) {
        friendRequest =
          await prisma.friendRequest.update({
            where: {
              id: existingOutgoingRequest.id
            },
            data: {
              status: "pending"
            },
            include: {
              sender: {
                select: {
                  id: true,
                  name: true,
                  avatar: true
                }
              },
              receiver: {
                select: {
                  id: true,
                  name: true,
                  avatar: true
                }
              }
            }
          });
      } else {
        friendRequest =
          await prisma.friendRequest.create({
            data: {
              senderId,
              receiverId,
              status: "pending"
            },
            include: {
              sender: {
                select: {
                  id: true,
                  name: true,
                  avatar: true
                }
              },
              receiver: {
                select: {
                  id: true,
                  name: true,
                  avatar: true
                }
              }
            }
          });
      }
  
      // Optional real-time notification for the receiver
      io
  .to(`user:${senderId}`)
  .to(`user:${receiverId}`)
  .emit("friendRequestUpdated", {
    type: "request-sent",
    request: friendRequest,
    senderId,
    receiverId
  });
  
      res.status(201).json({
        success: true,
        message: "Friend request sent",
        request: friendRequest
      });
    } catch (err) {
      console.error(
        "POST /friends/request error:",
        err
      );
  
      res.status(500).json({
        error: "Failed to send friend request"
      });
    }
  });
  
  // Get incoming and outgoing requests
  app.get(
    "/friends/requests/:userId",
    async (req, res) => {
      try {
        const userId =
          req.params.userId;

        if (!requireOwnUser(req, res, userId)) return;
  
        const user =
          await prisma.user.findUnique({
            where: {
              id: userId
            }
          });
  
        if (!user) {
          return res.status(404).json({
            error: "User not found"
          });
        }
  
        const [incoming, outgoing] =
          await Promise.all([
            prisma.friendRequest.findMany({
              where: {
                receiverId: userId,
                status: "pending"
              },
              include: {
                sender: {
                  select: {
                    id: true,
                    name: true,
                    avatar: true
                  }
                }
              },
              orderBy: {
                createdAt: "desc"
              }
            }),
  
            prisma.friendRequest.findMany({
              where: {
                senderId: userId,
                status: "pending"
              },
              include: {
                receiver: {
                  select: {
                    id: true,
                    name: true,
                    avatar: true
                  }
                }
              },
              orderBy: {
                createdAt: "desc"
              }
            })
          ]);
  
        res.json({
          incoming,
          outgoing
        });
      } catch (err) {
        console.error(
          "GET /friends/requests/:userId error:",
          err
        );
  
        res.status(500).json({
          error: "Failed to get friend requests"
        });
      }
    }
  );
  
  // Accept a friend request
  app.post(
    "/friends/requests/:requestId/accept",
    async (req, res) => {
      try {
        const requestId =
          req.params.requestId;
  
        const userId = req.auth.userId;
  
        const friendRequest =
          await prisma.friendRequest.findUnique({
            where: {
              id: requestId
            }
          });
  
        if (!friendRequest) {
          return res.status(404).json({
            error: "Friend request not found"
          });
        }
  
        if (
          String(friendRequest.receiverId) !==
          String(userId)
        ) {
          return res.status(403).json({
            error:
              "You cannot accept this friend request"
          });
        }
  
        if (
          friendRequest.status !== "pending"
        ) {
          return res.status(409).json({
            error:
              "This friend request is no longer pending"
          });
        }
  
        const senderId =
          friendRequest.senderId;
  
        const receiverId =
          friendRequest.receiverId;
  
        await prisma.$transaction([
          prisma.friendship.upsert({
            where: {
              userId_friendId: {
                userId: senderId,
                friendId: receiverId
              }
            },
            update: {},
            create: {
              userId: senderId,
              friendId: receiverId
            }
          }),
  
          prisma.friendship.upsert({
            where: {
              userId_friendId: {
                userId: receiverId,
                friendId: senderId
              }
            },
            update: {},
            create: {
              userId: receiverId,
              friendId: senderId
            }
          }),
  
          prisma.friendRequest.deleteMany({
            where: {
              OR: [
                {
                  senderId,
                  receiverId
                },
                {
                  senderId: receiverId,
                  receiverId: senderId
                }
              ]
            }
          })
        ]);
  
        io
          .to(`user:${senderId}`)
          .to(`user:${receiverId}`)
          .emit("friendRequestUpdated", {
            type: "request-accepted",
            senderId,
            receiverId
          });
          io
          .to(`user:${senderId}`)
          .to(`user:${receiverId}`)
          .emit("friendListUpdated", {
            type: "friend-added",
            senderId,
            receiverId
          });
  
        res.json({
          success: true,
          message: "Friend request accepted"
        });
      } catch (err) {
        console.error(
          "POST /friends/requests/:requestId/accept error:",
          err
        );
  
        res.status(500).json({
          error:
            "Failed to accept friend request"
        });
      }
    }
  );
  
  // Reject a friend request
  app.post(
    "/friends/requests/:requestId/reject",
    async (req, res) => {
      try {
        const requestId =
          req.params.requestId;
  
        const userId = req.auth.userId;
  
        const friendRequest =
          await prisma.friendRequest.findUnique({
            where: {
              id: requestId
            }
          });
  
        if (!friendRequest) {
          return res.status(404).json({
            error: "Friend request not found"
          });
        }
  
        if (
          String(friendRequest.receiverId) !==
          String(userId)
        ) {
          return res.status(403).json({
            error:
              "You cannot reject this friend request"
          });
        }
  
        await prisma.friendRequest.delete({
          where: {
            id: requestId
          }
        });
  
        io
  .to(`user:${friendRequest.senderId}`)
  .to(`user:${friendRequest.receiverId}`)
  .emit("friendRequestUpdated", {
    type: "request-rejected",
    requestId,
    senderId:
      friendRequest.senderId,
    receiverId:
      friendRequest.receiverId
  });
  
        res.json({
          success: true,
          message: "Friend request rejected"
        });
      } catch (err) {
        console.error(
          "POST /friends/requests/:requestId/reject error:",
          err
        );
  
        res.status(500).json({
          error:
            "Failed to reject friend request"
        });
      }
    }
  );

app.post("/friends/remove", async (req, res) => {
  try {
    const { friendId } = req.body;
    const userId = req.auth.userId;

    await prisma.friendship.deleteMany({
      where: {
        OR: [
          { userId, friendId },
          { userId: friendId, friendId: userId },
        ],
      },
    });

    io
  .to(`user:${userId}`)
  .to(`user:${friendId}`)
  .emit("friendListUpdated", {
    type: "friend-removed",
    userId,
    friendId
  });
  
    res.json({
      success: true,
      message: "Friend removed successfully",
      userFriends: [],
      friendFriends: [],
    });
  } catch (err) {
    console.error("POST /friends/remove error:", err);
    res.status(500).json({ error: "Failed to remove friend" });
  }
});

app.post("/users/:userId/flowers", async (req, res) => {
  try {
    if (!requireOwnUser(req, res, req.params.userId)) return;

    const user = await prisma.user.findUnique({
      where: {
        id: req.params.userId,
      },
      select: {
        id: true,
        timezone: true,
        aiConsent: {
          select: { aiProcessing: true }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const event =
      typeof req.body.event === "string"
        ? req.body.event.trim().slice(0, 2000)
        : "";
    let mood =
      typeof req.body.mood === "string"
        ? req.body.mood.trim().toLowerCase()
        : "";
    let emotionSource = "USER";
    let aiMetadata = null;

    if (!mood) {
      if (!event) {
        return res.status(400).json({
          error: "Choose a mood or write an optional journal entry"
        });
      }

      if (!user.aiConsent?.aiProcessing) {
        return res.status(403).json({
          error: "AI mood analysis requires your consent. Choose a mood manually or enable AI processing."
        });
      }

      const startedAt = Date.now();
      mood = await predictMood(event);
      emotionSource = "MODEL";
      aiMetadata = {
        task: "EMOTION_CLASSIFICATION",
        provider: "LOCAL",
        model: "natural-mood-classifier",
        inputHash: hashAiInput(event),
        outputLabel: mood,
        latencyMs: Date.now() - startedAt,
        success: true
      };
    }

    if (!Object.hasOwn(flowerDB, mood)) {
      return res.status(400).json({ error: "Unsupported mood" });
    }

    const garden = await ensureGarden(user.id);
    const timezone = normalizeTimezone(user.timezone) || "UTC";
    const localDate = getLocalDate(timezone);

    const existingCheckIn = await prisma.dailyCheckIn.findUnique({
      where: {
        userId_localDate: {
          userId: user.id,
          localDate
        }
      },
      include: { flower: { include: { messages: true } } }
    });

    if (existingCheckIn) {
      return res.status(409).json({
        error: "You have already completed today's check-in",
        checkInId: existingCheckIn.id,
        flower: existingCheckIn.flower
      });
    }

    const existingFlowers = await prisma.flower.findMany({
      where: {
        gardenId: garden.id,
      },
    });

    const options = flowerDB[mood] || flowerDB.calm;

if (!Array.isArray(options) || options.length === 0) {
  return res.status(400).json({
    error: "No flower configuration found for this mood",
  });
}

const chosen =
  options[Math.floor(Math.random() * options.length)];

const position =
  getNonOverlappingPosition(existingFlowers);

const flower = await prisma.$transaction(async (tx) => {
  const checkIn = await tx.dailyCheckIn.create({
    data: {
      userId: user.id,
      localDate,
      timezone,
      ...(event
        ? {
            journal: {
              create: {
                userId: user.id,
                content: event
              }
            }
          }
        : {}),
      emotionResult: {
        create: {
          userId: user.id,
          label: mood,
          source: emotionSource,
          modelVersion:
            emotionSource === "MODEL"
              ? "natural-mood-classifier"
              : null
        }
      }
    }
  });

  const createdFlower = await tx.flower.create({
    data: {
      mood,
      event,
      name: chosen.name,
      meaning: chosen.meaning,
      img: chosen.img,
      left: position.left,
      top: position.top,
      supportCount: 0,
      userId: user.id,
      gardenId: garden.id,
      dailyCheckInId: checkIn.id
    },
    include: { messages: true }
  });

  if (aiMetadata) {
    await tx.aiInteractionMetadata.create({
      data: {
        userId: user.id,
        dailyCheckInId: checkIn.id,
        ...aiMetadata
      }
    });
  }

  await tx.fairyState.upsert({
    where: { userId: user.id },
    update: {
      onboardingStep: "GARDEN_UNLOCKED",
      onboardingCompleted: true,
      lastEvent: "FLOWER_BLOOM"
    },
    create: {
      userId: user.id,
      onboardingStep: "GARDEN_UNLOCKED",
      onboardingCompleted: true,
      lastEvent: "FLOWER_BLOOM"
    }
  });

  return createdFlower;
});

    res.status(201).json(flower);
  } catch (err) {
    console.error("POST /users/:userId/flowers error:", err);
    if (err?.code === "P2002") {
      return res.status(409).json({
        error: "You have already completed today's check-in"
      });
    }
    res.status(500).json({ error: "Failed to create flower" });
  }
});

app.post(
    "/users/:userId/flowers/:flowerId/support",
    async (req, res) => {
      const startTime = Date.now();
  
      try {
        const { userId, flowerId } = req.params;
        const { visitorAvatar } = req.body;
        const visitorUserId = req.auth.userId;
  

        const flower = await prisma.flower.findFirst({
          where: {
            id: flowerId,
            userId
          },
          select: {
            id: true,
            gardenId: true
          }
        });
  
        if (!flower) {
          return res.status(404).json({
            error: "Flower not found"
          });
        }
  
        const [updatedFlower, visitor] = await Promise.all([
          prisma.flower.update({
            where: {
              id: flower.id
            },
            data: {
              supportCount: {
                increment: 1
              }
            },
            include: {
              messages: true
            }
          }),
  
          visitorUserId
            ? prisma.user.findUnique({
                where: {
                  id: visitorUserId
                },
                select: {
                  id: true,
                  name: true,
                  avatar: true
                }
              })
            : Promise.resolve(null)
        ]);
  
        const supportPayload = {
          gardenOwnerId: userId,
          flowerId: updatedFlower.id,
          flower: updatedFlower
        };
  
      
        io
          .to(`garden:${userId}`)
          .to(`user:${userId}`)
          .emit("supportUpdated", supportPayload);
  
        let newVisitRecord = null;
  
        if (visitor) {
          newVisitRecord = await prisma.visitRecord.create({
            data: {
              visitorId: visitor.id,
              visitorName: visitor.name,
              visitorAvatar:
                visitorAvatar ||
                visitor.avatar ||
                "🦋",
              action: "support",
              gardenId: flower.gardenId,
              userId: visitor.id
            }
          });
  
          io
            .to(`garden:${userId}`)
            .to(`user:${userId}`)
            .emit(
              "visitRecordAdded",
              newVisitRecord
            );
        }
  
        console.log(
          `support completed in ${Date.now() - startTime}ms`
        );
  
        res.json(updatedFlower);
      } catch (err) {
        console.error(
          "POST /users/:userId/flowers/:flowerId/support error:",
          err
        );
  
        console.log(
          `support failed after ${Date.now() - startTime}ms`
        );
  
        res.status(500).json({
          error: "Failed to support flower"
        });
      }
    }
  );
  
  app.post(
    "/users/:userId/flowers/:flowerId/message",
    async (req, res) => {
      const startTime = Date.now();
  
      try {
        const { userId, flowerId } = req.params;
  
        const {
          text,
          visitorAvatar
        } = req.body;
        const visitorUserId = req.auth.userId;
  
        const trimmedText =
          typeof text === "string"
            ? text.trim()
            : "";
  
        if (!trimmedText) {
          return res.status(400).json({
            error: "Message cannot be empty"
          });
        }
  
        const flower =
          await prisma.flower.findFirst({
            where: {
              id: flowerId,
              userId
            },
            select: {
              id: true,
              gardenId: true
            }
          });
  
        if (!flower) {
          return res.status(404).json({
            error: "Flower not found"
          });
        }
  
        const visitor = await prisma.user.findUnique({
          where: { id: visitorUserId },
          select: { id: true, name: true, avatar: true }
        });

        if (!visitor) {
          return res.status(401).json({ error: "Authenticated user not found" });
        }

        const newMessage = await prisma.message.create({
          data: {
            author: visitor.name,
            text: trimmedText,
            flowerId: flower.id,
            userId: visitor.id
          }
        });
  
        const updatedFlower =
          await prisma.flower.findUnique({
            where: {
              id: flower.id
            },
            include: {
              messages: true
            }
          });
  
        const messagePayload = {
          gardenOwnerId: userId,
          flowerId: updatedFlower.id,
          message: newMessage,
          flower: updatedFlower
        };
  
        io
          .to(`garden:${userId}`)
          .to(`user:${userId}`)
          .emit("messageAdded", messagePayload);
  
        if (visitor) {
          const newVisitRecord =
            await prisma.visitRecord.create({
              data: {
                visitorId: visitor.id,
                visitorName: visitor.name,
                visitorAvatar:
                  visitorAvatar ||
                  visitor.avatar ||
                  "🦋",
                action: `message:${trimmedText}`,
                gardenId: flower.gardenId,
                userId: visitor.id
              }
            });
  
          io
            .to(`garden:${userId}`)
            .to(`user:${userId}`)
            .emit("visitRecordAdded", {
              gardenOwnerId: userId,
              record: newVisitRecord
            });
        }
  
        console.log(
          `message completed in ${Date.now() - startTime}ms`
        );
  
        res.json(updatedFlower);
  
      } catch (err) {
        console.error(
          "POST /users/:userId/flowers/:flowerId/message error:",
          err
        );
  
        res.status(500).json({
          error: "Failed to add message"
        });
      }
    }
  );


app.delete("/users/:userId/flowers/:flowerId", async (req, res) => {
  try {
    if (!requireOwnUser(req, res, req.params.userId)) return;

    const user = await prisma.user.findUnique({
      where: {
        id: req.params.userId,
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const flower = await prisma.flower.findFirst({
      where: {
        id: req.params.flowerId,
        userId: user.id,
      },
    });

    if (!flower) {
      return res.status(404).json({ error: "Flower not found" });
    }

    await prisma.message.deleteMany({
      where: {
        flowerId: flower.id,
      },
    });

    const removedFlower = await prisma.flower.delete({
      where: {
        id: flower.id,
      },
    });

    res.json({
      success: true,
      message: "Flower deleted successfully",
      deletedFlower: removedFlower,
    });
  } catch (err) {
    console.error("DELETE /flowers error:", err);
    res.status(500).json({ error: "Failed to delete flower" });
  }
});

app.post("/visit", async (req, res) => {
  try {
    const {
      hostUserId,
      visitorAvatar,
      x = 120,
      y = 520,
    } = req.body;
    const visitorUserId = req.auth.userId;

    const host = await prisma.user.findUnique({
      where: {
        id: hostUserId,
      },
    });

    const visitor = await prisma.user.findUnique({
      where: {
        id: visitorUserId,
      },
    });

    if (!host || !visitor) {
      return res.status(404).json({ error: "User not found" });
    }

    const hostGarden = await ensureGarden(host.id);

    const visitors = getActiveVisitors(hostGarden.id);
    const existing = visitors.find((item) => item.visitorId === visitor.id);

    if (existing) {
      existing.x = x;
      existing.y = y;
      existing.avatar = visitorAvatar || visitor.avatar;
      existing.name = visitor.name;
    } else {
      visitors.push({
        visitorId: visitor.id,
        name: visitor.name,
        avatar: visitorAvatar || visitor.avatar,
        x,
        y,
      });
    }

    setActiveVisitors(hostGarden.id, visitors);

    const newVisitRecord = await prisma.visitRecord.create({
      data: {
        visitorId: visitor.id,
        visitorName: visitor.name,
        visitorAvatar:
          visitorAvatar ||
          visitor.avatar ||
          "🦋",
        action: "started visiting your garden",
        gardenId: hostGarden.id,
        userId: visitor.id,
      },
    });

    io
      .to(`garden:${host.id}`)
      .to(`user:${host.id}`)
      .emit("visitRecordAdded", {
        gardenOwnerId: host.id,
        record: newVisitRecord
      });

    const visitRecords = await prisma.visitRecord.findMany({
      where: {
        gardenId: hostGarden.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 30,
    });

    res.json({
      success: true,
      activeVisitors: getActiveVisitors(hostGarden.id),
      visitRecords,
    });
  } catch (err) {
    console.error("POST /visit error:", err);
    res.status(500).json({ error: "Failed to visit garden" });
  }
});

app.post("/visit/move", async (req, res) => {
  try {
    const { hostUserId, x, y, visitorAvatar } = req.body;
    const visitorUserId = req.auth.userId;

    if (typeof x !== "number" || typeof y !== "number") {
      return res.status(400).json({ error: "x and y must be numbers" });
    }

    const host = await prisma.user.findUnique({
      where: {
        id: hostUserId,
      },
    });

    const visitor = await prisma.user.findUnique({
      where: {
        id: visitorUserId,
      },
    });

    if (!host || !visitor) {
      return res.status(404).json({ error: "User not found" });
    }

    const hostGarden = await ensureGarden(host.id);
    const visitors = getActiveVisitors(hostGarden.id);

    const activeVisitor = visitors.find(
      (item) => item.visitorId === visitorUserId
    );

    if (!activeVisitor) {
      return res.status(404).json({ error: "Visitor not active in this garden" });
    }

    activeVisitor.x = x;
    activeVisitor.y = y;

    if (visitorAvatar) {
      activeVisitor.avatar = visitorAvatar;
    }

    setActiveVisitors(hostGarden.id, visitors);

const movedVisitor = {
  visitorId: activeVisitor.visitorId,
  name: activeVisitor.name,
  avatar: activeVisitor.avatar,
  x: activeVisitor.x,
  y: activeVisitor.y,
};

io.to(`garden:${hostUserId}`).emit(
  "avatarMoved",
  movedVisitor
);

res.json({
  success: true,
  activeVisitors: getActiveVisitors(hostGarden.id),
});

  } catch (err) {
    console.error("POST /visit/move error:", err);
    res.status(500).json({ error: "Failed to move visitor" });
  }
});

app.post("/leave", async (req, res) => {
    try {
      const {
        hostUserId,
        visitorAvatar
      } = req.body;
      const visitorUserId = req.auth.userId;
  
      const [host, visitor] =
        await Promise.all([
          prisma.user.findUnique({
            where: {
              id: hostUserId
            }
          }),
  
          prisma.user.findUnique({
            where: {
              id: visitorUserId
            }
          })
        ]);
  
      if (!host || !visitor) {
        return res
          .status(404)
          .json({
            error: "User not found"
          });
      }
  
      const hostGarden =
        await ensureGarden(host.id);
  
      const currentVisitors =
        getActiveVisitors(
          hostGarden.id
        );
  
      const remainingVisitors =
        currentVisitors.filter(
          (item) =>
            item.visitorId !==
            visitor.id
        );
  
      setActiveVisitors(
        hostGarden.id,
        remainingVisitors
      );
  
      const newVisitRecord =
        await prisma.visitRecord.create({
          data: {
            visitorId: visitor.id,
            visitorName: visitor.name,
            visitorAvatar:
              visitorAvatar ||
              visitor.avatar ||
              "🦋",
            action:
              "left your garden",
            gardenId:
              hostGarden.id,
            userId:
              visitor.id
          }
        });
  
      const payload = {
        gardenOwnerId:
          host.id,
        visitorId:
          visitor.id,
        record:
          newVisitRecord,
        activeVisitors:
          remainingVisitors
      };
  
      io
        .to(`garden:${host.id}`)
        .to(`user:${host.id}`)
        .emit(
          "visitorLeft",
          payload
        );
  
      io
        .to(`garden:${host.id}`)
        .to(`user:${host.id}`)
        .emit(
          "visitRecordAdded",
          payload
        );
  
      console.log(
        `${visitor.name} left ${host.name}'s garden`
      );
  
      res.json({
        success: true,
        activeVisitors:
          remainingVisitors,
        record:
          newVisitRecord
      });
  
    } catch (err) {
      console.error(err);
  
      res.status(500).json({
        error:
          "Failed to leave garden"
      });
    }
  });

app.post("/analyze-mood", async (req, res) => {
  try {
    const { text } = req.body;

    if (typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ error: "Text is required" });
    }

    const consent = await prisma.aiConsent.findUnique({
      where: { userId: req.auth.userId }
    });

    if (!consent?.aiProcessing) {
      return res.status(403).json({
        error: "AI mood analysis requires your consent"
      });
    }

    const normalizedText = text.trim().slice(0, 2000);
    const startedAt = Date.now();
    const mood = await predictMood(normalizedText);

    await prisma.aiInteractionMetadata.create({
      data: {
        userId: req.auth.userId,
        task: "EMOTION_CLASSIFICATION",
        provider: "LOCAL",
        model: "natural-mood-classifier",
        inputHash: hashAiInput(normalizedText),
        outputLabel: mood,
        latencyMs: Date.now() - startedAt,
        success: true
      }
    });

    res.json({ mood });
  } catch (err) {
    console.error("Mood analysis error:", err);
    res.status(500).json({ error: "Failed to analyze mood" });
  }
});

app.delete("/users/:id", async (req, res) => {
    try {
      const id = req.params.id;

      if (!requireOwnUser(req, res, id)) return;
  
      const user = await prisma.user.findUnique({
        where: { id }
      });
  
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
  
      await prisma.friendship.deleteMany({
        where: {
          OR: [
            { userId: id },
            { friendId: id }
          ]
        }
      });

      await prisma.friendRequest.deleteMany({
        where: {
          OR: [
            { senderId: id },
            { receiverId: id }
          ]
        }
      });
  
      const garden = await prisma.garden.findUnique({
        where: {
          ownerId: id
        }
      });
  
      if (garden) {
        const flowers = await prisma.flower.findMany({
          where: {
            gardenId: garden.id
          },
          select: {
            id: true
          }
        });
  
        const flowerIds = flowers.map((flower) => flower.id);
  
        if (flowerIds.length > 0) {
          await prisma.message.deleteMany({
            where: {
              flowerId: {
                in: flowerIds
              }
            }
          });
  
          await prisma.flower.deleteMany({
            where: {
              id: {
                in: flowerIds
              }
            }
          });
        }
  
        await prisma.visitRecord.deleteMany({
          where: {
            gardenId: garden.id
          }
        });
  
        await prisma.garden.delete({
          where: {
            id: garden.id
          }
        });
      }
  
      await prisma.visitRecord.deleteMany({
        where: {
          visitorId: id
        }
      });
  
      await prisma.message.deleteMany({
        where: {
          userId: id
        }
      });
  
      await prisma.user.delete({
        where: {
          id
        }
      });
  
      res.json({
        success: true,
        message: "User deleted successfully"
      });
    } catch (err) {
      console.error("DELETE /users/:id error:", err);
      res.status(500).json({
        error: err.message || "Failed to delete user"
      });
    }
  });

loadMoodModel()
  .then(() => {
    console.log("Mood model loaded.");
  })
  .catch((err) => {
    console.error("Failed to load mood model:", err);
  });
  const clientDistPath = path.join(
    __dirname,
    "client",
    "dist"
  );
  
  app.use(express.static(clientDistPath));
  
  app.use((req, res, next) => {
    if (
      req.method !== "GET" ||
      req.path.startsWith("/socket.io")
    ) {
      return next();
    }
  
    res.sendFile(
      path.join(
        clientDistPath,
        "index.html"
      )
    );
  });

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
