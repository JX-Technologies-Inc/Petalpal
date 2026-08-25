import { useEffect, useRef, useState } from "react";
import { apiRequest } from "../api";

const FLOWER_IMAGE_MAP = {
  "Cherry Blossom": "/assets/pink.png",
  Sunflower: "/assets/sunflower.png",
  Lotus: "/assets/blue.png",
  Lavender: "/assets/purple.png",
  Tulip: "/assets/tulip.png"
};

const EMPTY_LIST = Object.freeze([]);

function getFlowerImagePath(flower) {
  if (!flower) {
    return "/assets/pink.png";
  }

  const flowerName =
    flower.name || flower.type || "";

  if (FLOWER_IMAGE_MAP[flowerName]) {
    return FLOWER_IMAGE_MAP[flowerName];
  }

  const rawImage =
    flower.img ||
    flower.image ||
    flower.imagePath ||
    "";

  if (rawImage) {
    const fileName = rawImage
      .split("/")
      .pop();

    const availableFiles = [
      "blue.png",
      "pink.png",
      "purple.png",
      "sunflower.png",
      "tulip.png"
    ];

    if (availableFiles.includes(fileName)) {
      return `/assets/${fileName}`;
    }
  }

  return "/assets/pink.png";
}

function getFlowerPosition(flower, index) {
  const fallbackPositions = [
    { left: "18%", top: "62%" },
    { left: "32%", top: "55%" },
    { left: "46%", top: "64%" },
    { left: "60%", top: "53%" },
    { left: "74%", top: "63%" },
    { left: "85%", top: "50%" },
    { left: "25%", top: "74%" },
    { left: "52%", top: "76%" },
    { left: "78%", top: "75%" }
  ];

  const fallback =
    fallbackPositions[
      index % fallbackPositions.length
    ];

  return {
    left: flower.left || fallback.left,
    top: flower.top || fallback.top
  };
}

function GardenScene({
  owner,
  currentUser,
  socket,
  flowers = EMPTY_LIST,
  activeVisitors = EMPTY_LIST,
  isOwnGarden = false,
  highlightedDate = "",
  onDeleteFlower = async () => {}
}) {
  const [selectedFlower, setSelectedFlower] =
    useState(null);

  const [liveFlowers, setLiveFlowers] =
    useState(
      Array.isArray(flowers)
        ? flowers
        : []
    );

  const [visitorPositions, setVisitorPositions] =
    useState([]);

  const [messageText, setMessageText] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");

  const sceneRef = useRef(null);

  function updateFlowerEverywhere(
    flowerId,
    updater
  ) {
    setLiveFlowers((currentFlowers) =>
      currentFlowers.map((flower) =>
        String(flower.id) ===
        String(flowerId)
          ? updater(flower)
          : flower
      )
    );

    setSelectedFlower((currentFlower) => {
      if (
        !currentFlower ||
        String(currentFlower.id) !==
          String(flowerId)
      ) {
        return currentFlower;
      }

      return updater(currentFlower);
    });
  }

  function getMessageId(message) {
    return (
      message?.id ||
      message?.messageId ||
      message?.createdAt ||
      `${message?.author || message?.senderName || "Friend"}-${
        message?.text || ""
      }`
    );
  }

  function addMessageWithoutDuplicate(
    messages,
    incomingMessage
  ) {
    const currentMessages = Array.isArray(messages)
      ? messages
      : [];

    if (!incomingMessage) {
      return currentMessages;
    }

    const incomingId = getMessageId(
      incomingMessage
    );

    const alreadyExists =
      currentMessages.some(
        (message) =>
          String(getMessageId(message)) ===
          String(incomingId)
      );

    if (alreadyExists) {
      return currentMessages;
    }

    return [
      ...currentMessages,
      incomingMessage
    ];
  }

  useEffect(() => {
    const nextFlowers =
      Array.isArray(flowers)
        ? flowers
        : [];

    setLiveFlowers(nextFlowers);

    setSelectedFlower((currentFlower) => {
      if (!currentFlower?.id) {
        return currentFlower;
      }

      const refreshedFlower =
        nextFlowers.find(
          (flower) =>
            String(flower.id) ===
            String(currentFlower.id)
        );

      return refreshedFlower
        ? {
            ...currentFlower,
            ...refreshedFlower
          }
        : currentFlower;
    });
  }, [flowers]);

  useEffect(() => {
    setVisitorPositions(
      Array.isArray(activeVisitors)
        ? activeVisitors
        : []
    );
  }, [activeVisitors]);

  useEffect(() => {
    if (!socket) {
      return undefined;
    }

    function handleSupportUpdated(payload) {
      if (!payload) {
        return;
      }

      const eventGardenOwnerId =
        payload.gardenOwnerId ||
        payload.ownerId ||
        payload.userId;

      if (
        eventGardenOwnerId &&
        String(eventGardenOwnerId) !==
          String(owner?.id || "")
      ) {
        return;
      }

      const serverFlower =
        payload.flower &&
        typeof payload.flower === "object"
          ? payload.flower
          : null;

      const flowerId =
        payload.flowerId ||
        serverFlower?.id ||
        payload.id;

      const supportCount =
        payload.supportCount ??
        serverFlower?.supportCount;

      if (!flowerId) {
        return;
      }

      updateFlowerEverywhere(
        flowerId,
        (flower) => ({
          ...flower,
          ...(serverFlower || {}),
          supportCount:
            typeof supportCount === "number"
              ? supportCount
              : flower.supportCount
        })
      );
    }

    function handleMessageAdded(payload) {
      if (!payload) {
        return;
      }

      const eventGardenOwnerId =
        payload.gardenOwnerId ||
        payload.ownerId ||
        payload.userId;

      if (
        eventGardenOwnerId &&
        String(eventGardenOwnerId) !==
          String(owner?.id || "")
      ) {
        return;
      }

      const serverFlower =
        payload.flower &&
        typeof payload.flower === "object"
          ? payload.flower
          : null;

      const incomingMessage =
        payload.message ||
        payload.newMessage ||
        payload.createdMessage ||
        null;

      const flowerId =
        payload.flowerId ||
        serverFlower?.id ||
        incomingMessage?.flowerId ||
        payload.id;

      if (!flowerId) {
        return;
      }

      updateFlowerEverywhere(
        flowerId,
        (flower) => {
          if (serverFlower) {
            return {
              ...flower,
              ...serverFlower,
              messages:
                Array.isArray(
                  serverFlower.messages
                )
                  ? serverFlower.messages
                  : addMessageWithoutDuplicate(
                      flower.messages,
                      incomingMessage
                    )
            };
          }

          return {
            ...flower,
            messages:
              addMessageWithoutDuplicate(
                flower.messages,
                incomingMessage
              )
          };
        }
      );
    }

    socket.on(
      "supportUpdated",
      handleSupportUpdated
    );

    socket.on(
      "messageAdded",
      handleMessageAdded
    );

    return () => {
      socket.off(
        "supportUpdated",
        handleSupportUpdated
      );

      socket.off(
        "messageAdded",
        handleMessageAdded
      );
    };
  }, [
    socket,
    owner?.id
  ]);

  useEffect(() => {
    if (!socket) {
      return undefined;
    }

    function handleAvatarMoved(data) {
      if (!data) {
        return;
      }

      const eventGardenOwnerId =
        data.gardenOwnerId ||
        data.ownerId ||
        data.gardenId;

      if (
        eventGardenOwnerId &&
        String(eventGardenOwnerId) !==
          String(owner?.id || "")
      ) {
        return;
      }

      const visitorId =
        data.visitorId ||
        data.userId ||
        data.id;

      if (!visitorId) {
        return;
      }

      setVisitorPositions((current) => {
        const existingIndex =
          current.findIndex(
            (visitor) =>
              String(
                visitor.visitorId ||
                  visitor.userId ||
                  visitor.id
              ) === String(visitorId)
          );

        const updatedVisitor = {
          ...(existingIndex >= 0
            ? current[existingIndex]
            : {}),
          ...data,
          visitorId,
          id: data.id || visitorId,
          name:
            data.name ||
            data.visitorName ||
            (String(visitorId) ===
            String(currentUser?.id || "")
              ? currentUser?.name
              : "Visitor"),
          avatar:
            data.avatar ||
            (String(visitorId) ===
            String(currentUser?.id || "")
              ? currentUser?.avatar
              : "🦋"),
          x: Number(data.x) || 120,
          y: Number(data.y) || 520
        };

        if (existingIndex < 0) {
          return [
            ...current,
            updatedVisitor
          ];
        }

        return current.map(
          (visitor, index) =>
            index === existingIndex
              ? updatedVisitor
              : visitor
        );
      });
    }

    function handleVisitorLeft(data) {
      const visitorId =
        data?.visitorId ||
        data?.userId ||
        data?.id;

      if (!visitorId) {
        return;
      }

      setVisitorPositions((current) =>
        current.filter(
          (visitor) =>
            String(
              visitor.visitorId ||
                visitor.userId ||
                visitor.id
            ) !== String(visitorId)
        )
      );
    }

    socket.on(
      "avatarMoved",
      handleAvatarMoved
    );

    socket.on(
      "visitorLeft",
      handleVisitorLeft
    );

    return () => {
      socket.off(
        "avatarMoved",
        handleAvatarMoved
      );

      socket.off(
        "visitorLeft",
        handleVisitorLeft
      );
    };
  }, [
    socket,
    owner?.id,
    currentUser?.id,
    currentUser?.name,
    currentUser?.avatar
  ]);

  function getFlowerDate(flower) {
    if (!flower?.createdAt) {
      return "";
    }

    const date = new Date(flower.createdAt);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    const year = date.getFullYear();

    const month = String(
      date.getMonth() + 1
    ).padStart(2, "0");

    const day = String(
      date.getDate()
    ).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  function isHighlighted(flower) {
    if (!highlightedDate) {
      return false;
    }

    return (
      getFlowerDate(flower) ===
      highlightedDate
    );
  }

  async function handleDelete(flower) {
    const confirmed = window.confirm(
      `Delete this ${flower.name || "flower"}?`
    );

    if (!confirmed) {
      return;
    }

    try {
      await onDeleteFlower(flower.id);

      setSelectedFlower((current) =>
        current?.id === flower.id
          ? null
          : current
      );
    } catch (error) {
      console.error(
        "Delete flower error:",
        error
      );

      window.alert(
        error.message ||
          "Failed to delete flower."
      );
    }
  }

  async function postJson(path, body) {
    const normalizedPath = path.startsWith("/")
      ? path
      : `/${path}`;

    return apiRequest(normalizedPath, {
      method: "POST",
      body: JSON.stringify(body || {})
    });
  }

  async function handleGiveSupport() {
    if (
      isOwnGarden ||
      !selectedFlower?.id ||
      !owner?.id ||
      !currentUser?.id ||
      actionLoading
    ) {
      return;
    }

    const flowerId = selectedFlower.id;

    const previousSupportCount =
      Number(
        selectedFlower.supportCount
      ) || 0;

    const optimisticSupportCount =
      previousSupportCount + 1;

    setActionLoading(true);
    setActionError("");

    // Optimistic UI: show +1 immediately.
    updateFlowerEverywhere(
      flowerId,
      (flower) => ({
        ...flower,
        supportCount:
          optimisticSupportCount
      })
    );

    try {
      const response = await postJson(
        `/users/${owner.id}/flowers/${flowerId}/support`,
        {
          visitorUserId: currentUser.id,
          visitorAvatar:
            currentUser.avatar || "🦋"
        }
      );

      const serverFlower =
        response?.flower &&
        typeof response.flower === "object"
          ? response.flower
          : response;

      const serverSupportCount =
        response?.supportCount ??
        serverFlower?.supportCount;

      updateFlowerEverywhere(
        flowerId,
        (flower) => ({
          ...flower,
          ...(serverFlower &&
          typeof serverFlower === "object"
            ? serverFlower
            : {}),
          supportCount:
            typeof serverSupportCount ===
            "number"
              ? serverSupportCount
              : flower.supportCount
        })
      );
    } catch (error) {
      console.error(
        "Support flower error:",
        error
      );

      // Roll back the optimistic +1.
      updateFlowerEverywhere(
        flowerId,
        (flower) => ({
          ...flower,
          supportCount:
            previousSupportCount
        })
      );

      setActionError(
        error.message ||
          "Failed to give support."
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function handleLeaveMessage(event) {
    event.preventDefault();

    const cleanMessage =
      messageText.trim();

    if (
      isOwnGarden ||
      !cleanMessage ||
      !selectedFlower?.id ||
      !owner?.id ||
      !currentUser?.id ||
      actionLoading
    ) {
      return;
    }

    const flowerId = selectedFlower.id;
    const temporaryMessageId =
      `temporary-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}`;

    const temporaryMessage = {
      id: temporaryMessageId,
      author:
        currentUser.name ||
        currentUser.displayName ||
        "Friend",
      senderName:
        currentUser.name ||
        currentUser.displayName ||
        "Friend",
      text: cleanMessage,
      createdAt:
        new Date().toISOString(),
      pending: true
    };

    setActionLoading(true);
    setActionError("");
    setMessageText("");

    // Optimistic UI: display the message immediately.
    updateFlowerEverywhere(
      flowerId,
      (flower) => ({
        ...flower,
        messages: [
          ...(Array.isArray(
            flower.messages
          )
            ? flower.messages
            : []),
          temporaryMessage
        ]
      })
    );

    try {
      const response = await postJson(
        `/users/${owner.id}/flowers/${flowerId}/message`,
        {
          author:
            currentUser.name ||
            currentUser.displayName ||
            "Friend",
          text: cleanMessage,
          visitorUserId:
            currentUser.id,
          visitorAvatar:
            currentUser.avatar || "🦋"
        }
      );

      const serverFlower =
        response?.flower &&
        typeof response.flower === "object"
          ? response.flower
          : response?.id === flowerId ||
            Array.isArray(response?.messages)
            ? response
            : null;

      const serverMessage =
        response?.message ||
        response?.newMessage ||
        response?.createdMessage ||
        null;

      updateFlowerEverywhere(
        flowerId,
        (flower) => {
          if (serverFlower) {
            return {
              ...flower,
              ...serverFlower,
              messages:
                Array.isArray(
                  serverFlower.messages
                )
                  ? serverFlower.messages
                  : flower.messages
            };
          }

          const messagesWithoutTemporary =
            (
              Array.isArray(
                flower.messages
              )
                ? flower.messages
                : []
            ).filter(
              (message) =>
                String(message.id) !==
                String(
                  temporaryMessageId
                )
            );

          return {
            ...flower,
            messages: serverMessage
              ? addMessageWithoutDuplicate(
                  messagesWithoutTemporary,
                  serverMessage
                )
              : messagesWithoutTemporary
          };
        }
      );
    } catch (error) {
      console.error(
        "Leave message error:",
        error
      );

      // Remove the temporary message and restore the text.
      updateFlowerEverywhere(
        flowerId,
        (flower) => ({
          ...flower,
          messages: (
            Array.isArray(
              flower.messages
            )
              ? flower.messages
              : []
          ).filter(
            (message) =>
              String(message.id) !==
              String(
                temporaryMessageId
              )
          )
        })
      );

      setMessageText(cleanMessage);

      setActionError(
        error.message ||
          "Failed to leave message."
      );
    } finally {
      setActionLoading(false);
    }
  }

  function moveCurrentVisitor(nextX, nextY) {
    if (
      isOwnGarden ||
      !socket ||
      !currentUser?.id ||
      !owner?.id
    ) {
      return;
    }

    const movementData = {
      visitorId: currentUser.id,
      userId: currentUser.id,
      gardenOwnerId: owner.id,
      ownerId: owner.id,
      name:
        currentUser.name ||
        currentUser.displayName ||
        "Visitor",
      avatar: currentUser.avatar || "🦋",
      x: Math.round(nextX),
      y: Math.round(nextY)
    };

    setVisitorPositions((current) => {
      const existingIndex =
        current.findIndex(
          (visitor) =>
            String(
              visitor.visitorId ||
                visitor.userId ||
                visitor.id
            ) === String(currentUser.id)
        );

      if (existingIndex < 0) {
        return [...current, movementData];
      }

      return current.map((visitor, index) =>
        index === existingIndex
          ? { ...visitor, ...movementData }
          : visitor
      );
    });

    socket.emit("move-avatar", movementData);

    window.requestAnimationFrame(() => {
      const scene = sceneRef.current;
      if (!scene) return;

      const avatarElement = scene.querySelector(
        `[data-visitor-id="${CSS.escape(String(currentUser.id))}"]`
      );

      if (!avatarElement) return;

      const avatarRect =
        avatarElement.getBoundingClientRect();

      const touchedFlower = liveFlowers.find((flower) => {
        const flowerElement = scene.querySelector(
          `[data-flower-card-id="${CSS.escape(String(flower.id))}"]`
        );

        if (!flowerElement) return false;

        const flowerRect =
          flowerElement.getBoundingClientRect();

        return !(
          avatarRect.right < flowerRect.left ||
          avatarRect.left > flowerRect.right ||
          avatarRect.bottom < flowerRect.top ||
          avatarRect.top > flowerRect.bottom
        );
      });

      if (touchedFlower) {
        setSelectedFlower(touchedFlower);
      }
    });
  }

  useEffect(() => {
    if (
      isOwnGarden ||
      !currentUser?.id ||
      !owner?.id
    ) {
      return undefined;
    }

    function handleKeyDown(event) {
      const movementAmount = 18;
      const movementMap = {
        ArrowUp: { x: 0, y: -movementAmount },
        ArrowDown: { x: 0, y: movementAmount },
        ArrowLeft: { x: -movementAmount, y: 0 },
        ArrowRight: { x: movementAmount, y: 0 }
      };

      const movement = movementMap[event.key];
      if (!movement) return;

      const activeTag =
        document.activeElement?.tagName?.toLowerCase();

      if (
        activeTag === "input" ||
        activeTag === "textarea" ||
        activeTag === "select"
      ) {
        return;
      }

      event.preventDefault();

      const scene = sceneRef.current;
      if (!scene) return;

      const currentVisitor = visitorPositions.find(
        (visitor) =>
          String(
            visitor.visitorId ||
              visitor.userId ||
              visitor.id
          ) === String(currentUser.id)
      );

      const avatarWidth = 48;
      const avatarHeight = 60;
      const currentX = Number(currentVisitor?.x) || 120;
      const currentY = Number(currentVisitor?.y) || 520;

      const nextX = Math.max(
        0,
        Math.min(
          currentX + movement.x,
          scene.clientWidth - avatarWidth
        )
      );

      const nextY = Math.max(
        0,
        Math.min(
          currentY + movement.y,
          scene.clientHeight - avatarHeight
        )
      );

      moveCurrentVisitor(nextX, nextY);
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [
    isOwnGarden,
    currentUser?.id,
    currentUser?.name,
    currentUser?.avatar,
    owner?.id,
    socket,
    visitorPositions,
    liveFlowers
  ]);

  function handleGardenClick(event) {
    if (
      isOwnGarden ||
      !socket ||
      !currentUser?.id ||
      !owner?.id
    ) {
      return;
    }

    if (
      event.target.closest(
        ".flower-card"
      ) ||
      event.target.closest(
        ".flower-detail-card"
      )
    ) {
      return;
    }

    const sceneRect =
      event.currentTarget.getBoundingClientRect();

    const avatarWidth = 48;
    const avatarHeight = 60;

    const rawX =
      event.clientX -
      sceneRect.left -
      avatarWidth / 2;

    const rawY =
      event.clientY -
      sceneRect.top -
      avatarHeight / 2;

    const x = Math.max(
      0,
      Math.min(
        rawX,
        sceneRect.width - avatarWidth
      )
    );

    const y = Math.max(
      0,
      Math.min(
        rawY,
        sceneRect.height - avatarHeight
      )
    );

    moveCurrentVisitor(x, y);
  }

  const gardenTitle = owner
    ? isOwnGarden
      ? "Your Garden"
      : `${owner.name}'s Garden`
    : "Garden";

  return (
    <>
      <h2
        className="garden-title"
        id="gardenTitle"
      >
        {gardenTitle}
      </h2>

      <div
        ref={sceneRef}
        id="garden-scene"
        className={`garden-scene ${
          highlightedDate
            ? "calendar-filter-active"
            : ""
        } ${
          !isOwnGarden
            ? "visitable-garden"
            : ""
        }`}
        onClick={handleGardenClick}
      >
        <div className="sky-layer"></div>
        <div className="background-layer"></div>
        <div className="backgrass-layer"></div>

        <div
          id="decoration-layer"
          className="decoration-layer"
        ></div>

        <div
          id="garden"
          className="flower-layer"
        >
          {liveFlowers.length === 0 && (
            <p className="empty-garden-message">
              No flowers yet. Share your day
              and let something bloom 🌱
            </p>
          )}

          {liveFlowers.map((flower, index) => {
            const highlighted =
              isHighlighted(flower);

            const dimmed =
              Boolean(highlightedDate) &&
              !highlighted;

            const position =
              getFlowerPosition(
                flower,
                index
              );

            return (
              <article
                key={flower.id}
                data-flower-card-id={flower.id}
                className={[
                  "flower-card",
                  highlighted
                    ? "calendar-highlighted-flower"
                    : "",
                  dimmed
                    ? "calendar-dimmed-flower"
                    : ""
                ]
                  .filter(Boolean)
                  .join(" ")}
                style={position}
                onClick={(event) => {
                  event.stopPropagation();

                  setSelectedFlower(
                    selectedFlower?.id ===
                      flower.id
                      ? null
                      : flower
                  );
                }}
              >
                <div className="flower-shadow"></div>

                <img
                  className="flower-image"
                  src={getFlowerImagePath(
                    flower
                  )}
                  alt={
                    flower.name ||
                    `${
                      flower.mood ||
                      "garden"
                    } flower`
                  }
                  draggable="false"
                  onError={(event) => {
                    event.currentTarget.onerror =
                      null;

                    event.currentTarget.src =
                      "/assets/pink.png";
                  }}
                />

                <span
                  className="flower-support-count"
                  data-flower-id={flower.id}
                >
                  {flower.supportCount || 0}
                </span>
              </article>
            );
          })}

          {visitorPositions.map(
            (visitor) => {
              const visitorId =
                visitor.visitorId ||
                visitor.userId ||
                visitor.id;

              return (
                <div
                  key={visitorId}
                  data-visitor-id={visitorId}
                  className="garden-visitor-avatar"
                  style={{
                    left: `${
                      Number(visitor.x) || 120
                    }px`,
                    top: `${
                      Number(visitor.y) || 520
                    }px`
                  }}
                  title={
                    visitor.name ||
                    visitor.visitorName ||
                    "Visitor"
                  }
                >
                  <span>
                    {visitor.avatar || "🦋"}
                  </span>

                  <small>
                    {visitor.name ||
                      visitor.visitorName ||
                      "Visitor"}
                  </small>
                </div>
              );
            }
          )}
        </div>

        <div className="frontgrass-left"></div>
        <div className="frontgrass-right"></div>

        {selectedFlower && (
          <div
            className="flower-detail-card"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <button
              className="flower-detail-close"
              type="button"
              aria-label="Close flower details"
              onClick={() => {
                setSelectedFlower(null);
                setMessageText("");
                setActionError("");
              }}
            >
              ×
            </button>

            <h3>
              {selectedFlower.name ||
                "Garden Flower"}
            </h3>

            <p>
              <strong>Mood:</strong>{" "}
              {selectedFlower.mood ||
                "Unknown"}
            </p>

            {selectedFlower.event && (
              <p>
                <strong>Memory:</strong>{" "}
                {selectedFlower.event}
              </p>
            )}

            {selectedFlower.meaning && (
              <p>
                <strong>Meaning:</strong>{" "}
                {selectedFlower.meaning}
              </p>
            )}

            <p>
              <strong>Support:</strong>{" "}
              {selectedFlower.supportCount ||
                0}
            </p>

            {selectedFlower.messages
              ?.length > 0 && (
              <div className="flower-message-list">
                <strong>Messages:</strong>

                {selectedFlower.messages.map(
                  (message) => (
                    <p
                      key={
                        message.id ||
                        `${message.author}-${message.text}`
                      }
                    >
                      {message.author ||
                        message.senderName ||
                        "Friend"}
                      : {message.text}
                      {message.pending
                        ? " (sending...)"
                        : ""}
                    </p>
                  )
                )}
              </div>
            )}

            {!isOwnGarden && (
              <div className="flower-visitor-actions">
                <button
                  type="button"
                  className="support-flower-button"
                  disabled={actionLoading}
                  onClick={handleGiveSupport}
                >
                  {actionLoading
                    ? "Working..."
                    : "Give Support 💗"}
                </button>

                <form
                  className="leave-message-form"
                  onSubmit={handleLeaveMessage}
                >
                  <textarea
                    value={messageText}
                    onChange={(event) =>
                      setMessageText(event.target.value)
                    }
                    placeholder="Leave a kind message..."
                    maxLength={300}
                    rows={3}
                    disabled={actionLoading}
                  />

                  <button
                    type="submit"
                    disabled={
                      actionLoading ||
                      !messageText.trim()
                    }
                  >
                    Leave Message
                  </button>
                </form>

                {actionError && (
                  <p className="flower-action-error">
                    {actionError}
                  </p>
                )}
              </div>
            )}

            {isOwnGarden && (
              <button
                className="delete-flower-button"
                type="button"
                onClick={() =>
                  handleDelete(
                    selectedFlower
                  )
                }
              >
                Delete Flower
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}

export default GardenScene;
