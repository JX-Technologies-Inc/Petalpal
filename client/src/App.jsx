import {
    useCallback,
    useEffect,
    useRef,
    useState
  } from "react";
  
  import "./App.css";
  
  import { io } from "socket.io-client";
  import { apiRequest } from "./api";
  import { logoutFirebase, pendingPasswordRegistration } from "./Auth/firebaseSession";
  
  import LoginForm from "./Auth/LoginForm";
  import RegisterForm from "./Auth/RegisterForm";
  import CompleteProfileForm from "./Auth/CompleteProfileForm";
  import OnboardingFlow from "./Onboarding/OnboardingFlow";
  
  import CurrentProfile from "./Profile/CurrentProfile";
  
  import DailyCheckIn from "./Garden/DailyCheckIn";
  import GardenScene from "./Garden/GardenScene";
  import Calendar from "./Garden/Calendar";
  import VisitorRecords from "./Garden/VisitorRecords";
  
  import VisitorForm from "./Visit/VisitorForm";
  import FriendStatus from "./Visit/FriendStatus";
  
  import FriendSearch from "./Friends/FriendSearch";
  import FriendList from "./Friends/FriendList";
  import FriendRequests from "./Friends/FriendRequests";
  
  function getSocketUrl() {
    const configuredUrl =
      import.meta.env.VITE_SOCKET_URL ||
      import.meta.env.VITE_API_URL ||
      window.location.origin;

    return String(configuredUrl)
      .replace(/\/api\/?$/, "")
      .replace(/\/$/, "");
  }

  function WelcomePanel() {
    return (
      <section
        id="loginWelcomePanel"
        className="login-welcome-panel"
      >
        <div className="login-welcome-hero">
          <div className="welcome-hero-overlay"></div>
  
          <div className="welcome-hero-content">
            <span className="welcome-badge">
              YOUR SOCIAL MOOD GARDEN
            </span>
  
            <h2>
              Grow something beautiful from
              every feeling.
            </h2>
  
            <p>
              Record your day, bloom a flower,
              revisit your memories, and share
              kindness with friends.
            </p>
  
            <div className="welcome-feature-row">
              <span>🌸 Daily mood flowers</span>
              <span>🦋 Live garden visits</span>
              <span>💌 Supportive messages</span>
            </div>
          </div>
        </div>
  
        <div className="notice-board">
          <div className="notice-board-header">
            <div className="notice-board-icon">
              📌
            </div>
  
            <div>
              <p className="notice-board-eyebrow">
                GETTING STARTED
              </p>
  
              <h2>PetalPal Notice Board</h2>
  
              <p>
                A quick guide to growing and
                sharing your garden.
              </p>
            </div>
          </div>
  
          <article className="notice-card notice-welcome">
            <span className="notice-label">
              WELCOME
            </span>
  
            <h3>
              Let your emotions bloom 🌷
            </h3>
  
            <p>
              PetalPal turns your daily feelings
              into flowers, creating a garden
              filled with memories over time.
            </p>
          </article>
  
          <article className="notice-card">
            <h3>How to use PetalPal</h3>
  
            <div className="guide-step">
              <span className="guide-number">
                1
              </span>
  
              <div>
                <strong>Share your day</strong>
  
                <p>
                  Write what happened and choose
                  a mood, or let PetalPal detect
                  one from your entry.
                </p>
              </div>
            </div>
  
            <div className="guide-step">
              <span className="guide-number">
                2
              </span>
  
              <div>
                <strong>Bloom a flower</strong>
  
                <p>
                  Your mood becomes a flower
                  planted in your personal garden.
                </p>
              </div>
            </div>
  
            <div className="guide-step">
              <span className="guide-number">
                3
              </span>
  
              <div>
                <strong>Visit your friends</strong>
  
                <p>
                  Search for friends, enter their
                  gardens, send support, and leave
                  kind messages.
                </p>
              </div>
            </div>
  
            <div className="guide-step">
              <span className="guide-number">
                4
              </span>
  
              <div>
                <strong>
                  Explore your memories
                </strong>
  
                <p>
                  Use the flower calendar to
                  highlight everything that
                  bloomed on a particular day.
                </p>
              </div>
            </div>
          </article>
        </div>
      </section>
    );
  }
  
  function App() {
    const [
      activeAuthTab,
      setActiveAuthTab
    ] = useState(() => pendingPasswordRegistration() ? "register" : "login");
  
    const [
      currentUser,
      setCurrentUser
    ] = useState(() => {
      try {
        const savedUser =
          localStorage.getItem(
            "petalPalCurrentUser"
          );
  
        return savedUser
          ? JSON.parse(savedUser)
          : null;
      } catch {
        return null;
      }
    });
    const [pendingProfileEmail, setPendingProfileEmail] = useState("");
    const [pendingProfileAuthMethod, setPendingProfileAuthMethod] = useState("passwordless");
    const [isAwaitingEmailVerification, setIsAwaitingEmailVerification] = useState(() => Boolean(pendingPasswordRegistration()));
  
    const [gardenData, setGardenData] =
      useState({
        owner: null,
        flowers: [],
        visitRecords: [],
        activeVisitors: []
      });

    const [experience, setExperience] = useState({
      fairyState: null,
      todayCheckIn: null,
      hasCheckedInToday: false,
      loading: Boolean(currentUser?.id)
    });
  
    const [
      gardenLoading,
      setGardenLoading
    ] = useState(false);
  
    const [
      gardenError,
      setGardenError
    ] = useState("");
  
    const [
      selectedCalendarDate,
      setSelectedCalendarDate
    ] = useState("");
    const [
      friendRefreshVersion,
      setFriendRefreshVersion
    ] = useState(0);

    const socketRef = useRef(null);
    const viewedGardenOwnerIdRef =
      useRef(null);
    const reloadTimerRef =
      useRef(null);

  
    const isLoggedIn =
      Boolean(currentUser?.id);
  
    const isOwnGarden =
      String(gardenData.owner?.id || "") ===
      String(currentUser?.id || "");
  
    const loadGarden = useCallback(
      async (userId) => {
        if (!userId) {
          return;
        }
  
        try {
          setGardenLoading(true);
          setGardenError("");
  
          const data = await apiRequest(
            `/users/${encodeURIComponent(
              userId
            )}/garden`
          );
  
          setGardenData({
            owner: data?.owner || null,
  
            flowers: Array.isArray(
              data?.flowers
            )
              ? data.flowers
              : [],
  
            visitRecords: Array.isArray(
              data?.visitRecords
            )
              ? data.visitRecords
              : [],
  
            activeVisitors: Array.isArray(
              data?.activeVisitors
            )
              ? data.activeVisitors
              : []
          });
        } catch (error) {
          console.error(
            "Load garden error:",
            error
          );
  
          setGardenError(
            error.message ||
              "Failed to load garden."
          );
        } finally {
          setGardenLoading(false);
        }
      },
      []
    );

    const loadSession = useCallback(async () => {
      try {
        setGardenLoading(true);
        setGardenError("");

        const data = await apiRequest("/session");

        setCurrentUser(data.user);
        localStorage.setItem(
          "petalPalCurrentUser",
          JSON.stringify(data.user)
        );

        setExperience({
          fairyState: data.fairyState || null,
          todayCheckIn: data.todayCheckIn || null,
          hasCheckedInToday: Boolean(data.hasCheckedInToday),
          loading: false
        });

        setGardenData({
          owner: data.garden?.owner || data.user,
          flowers: Array.isArray(data.garden?.flowers)
            ? data.garden.flowers
            : [],
          visitRecords: Array.isArray(data.garden?.visitRecords)
            ? data.garden.visitRecords
            : [],
          activeVisitors: Array.isArray(data.garden?.activeVisitors)
            ? data.garden.activeVisitors
            : []
        });
      } catch (error) {
        console.error("Load session error:", error);
        setGardenError(error.message || "Failed to restore your garden.");
        setExperience((current) => ({ ...current, loading: false }));
      } finally {
        setGardenLoading(false);
      }
    }, []);
  
    useEffect(() => {
      if (!currentUser?.id) {
        return;
      }
  
      loadSession();
    }, [currentUser?.id, loadSession]);

    useEffect(() => {
      viewedGardenOwnerIdRef.current =
        gardenData.owner?.id ||
        currentUser?.id ||
        null;
    }, [gardenData.owner?.id, currentUser?.id]);

    useEffect(() => {
      if (!currentUser?.id) {
        return undefined;
      }

      const socket = io(getSocketUrl(), {
        transports: ["websocket", "polling"],
        reconnection: true,
        auth: {
          token: localStorage.getItem(
            "petalPalAccessToken"
          )
        }
      });

      socketRef.current = socket;

      const joinRooms = () => {
        socket.emit(
          "join-user",
          currentUser.id
        );

        const gardenOwnerId =
          viewedGardenOwnerIdRef.current;

        if (gardenOwnerId) {
          socket.emit(
            "join-garden",
            gardenOwnerId
          );
        }
      };

      const reloadVisibleGarden = () => {
        const gardenOwnerId =
          viewedGardenOwnerIdRef.current;

        if (!gardenOwnerId) {
          return;
        }

        if (reloadTimerRef.current) {
          window.clearTimeout(
            reloadTimerRef.current
          );
        }

        reloadTimerRef.current =
          window.setTimeout(() => {
            loadGarden(gardenOwnerId);
          }, 100);
      };
      const handleVisitorLeft = (payload) => {
        if (!payload) {
          return;
        }
      
        const eventGardenOwnerId =
          payload.gardenOwnerId;
      
        const visibleGardenOwnerId =
          viewedGardenOwnerIdRef.current;
      
        if (
          eventGardenOwnerId &&
          String(eventGardenOwnerId) !==
            String(visibleGardenOwnerId)
        ) {
          return;
        }
      
        const leavingVisitorId =
          payload.visitorId;
      
        setGardenData((currentGarden) => {
          const nextActiveVisitors =
            Array.isArray(payload.activeVisitors)
              ? payload.activeVisitors
              : currentGarden.activeVisitors.filter(
                  (visitor) =>
                    String(
                      visitor.visitorId ||
                        visitor.userId ||
                        visitor.id
                    ) !==
                    String(leavingVisitorId)
                );
      
          const currentRecords =
            Array.isArray(
              currentGarden.visitRecords
            )
              ? currentGarden.visitRecords
              : [];
      
          const nextRecords =
            payload.record &&
            !currentRecords.some(
              (record) =>
                String(record.id) ===
                String(payload.record.id)
            )
              ? [
                  payload.record,
                  ...currentRecords
                ].slice(0, 30)
              : currentRecords;
      
          return {
            ...currentGarden,
            activeVisitors:
              nextActiveVisitors,
            visitRecords:
              nextRecords
          };
        });
      };

      const refreshFriendComponents = () => {
        setFriendRefreshVersion(
          (version) => version + 1
        );
      };

      socket.on("connect", joinRooms);

      socket.on(
        "supportUpdated",
        reloadVisibleGarden
      );

      socket.on(
        "messageAdded",
        reloadVisibleGarden
      );

      socket.on(
        "visitRecordAdded",
        reloadVisibleGarden
      );
      socket.on(
        "visitorLeft",
        handleVisitorLeft
      );
      

      socket.on(
        "gardenUpdated",
        reloadVisibleGarden
      );

      socket.on(
        "flowerCreated",
        reloadVisibleGarden
      );

      socket.on(
        "flowerDeleted",
        reloadVisibleGarden
      );

      socket.on(
        "friendRequestUpdated",
        refreshFriendComponents
      );

      socket.on(
        "friendListUpdated",
        refreshFriendComponents
      );

      socket.on(
        "friendshipUpdated",
        refreshFriendComponents
      );

      socket.on("connect_error", (error) => {
        console.error(
          "Socket.IO connection error:",
          error.message
        );
      });

      return () => {
        if (reloadTimerRef.current) {
          window.clearTimeout(
            reloadTimerRef.current
          );

          reloadTimerRef.current = null;
        }

        socket.removeAllListeners();
        socket.disconnect();
        socketRef.current = null;
      };
    }, [currentUser?.id, loadGarden]);

    useEffect(() => {
      const socket = socketRef.current;
      const gardenOwnerId =
        gardenData.owner?.id;

      if (!socket?.connected || !gardenOwnerId) {
        return;
      }

      socket.emit(
        "join-garden",
        gardenOwnerId
      );
    }, [gardenData.owner?.id]);
  
    function handleLogin(user, authResult = {}) {
      if (authResult.needsProfile) {
        setIsAwaitingEmailVerification(false);
        setPendingProfileEmail(authResult.email || "");
        setPendingProfileAuthMethod(authResult.authMethod || "passwordless");
        return;
      }
      setPendingProfileEmail("");
      setPendingProfileAuthMethod("passwordless");
      setIsAwaitingEmailVerification(false);
      setCurrentUser(user);
  
      localStorage.setItem(
        "petalPalCurrentUser",
        JSON.stringify(user)
      );
    }
  
    function handleLogout() {
      void logoutFirebase();
      setCurrentUser(null);
      setPendingProfileEmail("");
      setPendingProfileAuthMethod("passwordless");
      setIsAwaitingEmailVerification(false);
      setActiveAuthTab("login");
  
      setGardenData({
        owner: null,
        flowers: [],
        visitRecords: [],
        activeVisitors: []
      });
  
      setSelectedCalendarDate("");
      setGardenError("");
      setExperience({
        fairyState: null,
        todayCheckIn: null,
        hasCheckedInToday: false,
        loading: false
      });
      viewedGardenOwnerIdRef.current = null;
  
      localStorage.removeItem(
        "petalPalCurrentUser"
      );
      localStorage.removeItem(
        "petalPalAccessToken"
      );
    }

    useEffect(() => {
      window.addEventListener(
        "petalpal:unauthorized",
        handleLogout
      );

      return () => {
        window.removeEventListener(
          "petalpal:unauthorized",
          handleLogout
        );
      };
    }, []);

    async function handleOnboardingAdvance(update) {
      if (!currentUser?.id) return;

      const fairyState = await apiRequest(
        `/users/${encodeURIComponent(currentUser.id)}/fairy-state`,
        {
          method: "PUT",
          body: JSON.stringify(update)
        }
      );

      setExperience((current) => ({
        ...current,
        fairyState
      }));
    }
  
    function handleAvatarChange(avatar) {
      setCurrentUser((previousUser) => {
        if (!previousUser) {
          return previousUser;
        }
  
        const updatedUser = {
          ...previousUser,
          avatar
        };
  
        localStorage.setItem(
          "petalPalCurrentUser",
          JSON.stringify(updatedUser)
        );
  
        return updatedUser;
      });
  
      setGardenData((currentGarden) => {
        if (
          String(currentGarden.owner?.id || "") !==
          String(currentUser?.id || "")
        ) {
          return currentGarden;
        }
  
        return {
          ...currentGarden,
          owner: currentGarden.owner
            ? {
                ...currentGarden.owner,
                avatar
              }
            : currentGarden.owner
        };
      });
    }
  
    async function handleVisitFriend(friend) {
        if (!currentUser?.id) {
          throw new Error("Please log in first.");
        }
      
        if (!friend?.id) {
          throw new Error(
            "This friend could not be opened."
          );
        }
      
        const previousGardenOwnerId =
          viewedGardenOwnerIdRef.current;
      
        try {
          setSelectedCalendarDate("");
          setGardenError("");
      
         
          if (
            previousGardenOwnerId &&
            String(previousGardenOwnerId) !==
              String(currentUser.id) &&
            String(previousGardenOwnerId) !==
              String(friend.id)
          ) {
            await apiRequest("/leave", {
              method: "POST",
              body: JSON.stringify({
                hostUserId:
                  previousGardenOwnerId,
                visitorUserId:
                  currentUser.id,
                visitorAvatar:
                  currentUser.avatar || "🦋"
              })
            });
          }
      
         
          await apiRequest("/visit", {
            method: "POST",
            body: JSON.stringify({
              hostUserId: friend.id,
              visitorUserId:
                currentUser.id,
              visitorAvatar:
                currentUser.avatar || "🦋",
              x: 120,
              y: 520
            })
          });
      
          viewedGardenOwnerIdRef.current =
            friend.id;
      
          socketRef.current?.emit(
            "join-garden",
            friend.id
          );
      
          await loadGarden(friend.id);
        } catch (error) {
          console.error(
            "Visit friend error:",
            error
          );
      
          setGardenError(
            error.message ||
              "Failed to visit garden."
          );
      
          throw error;
        }
      }
      
      async function handleBackToMyGarden() {
        if (!currentUser?.id) {
          return;
        }
      
        const previousGardenOwnerId =
          viewedGardenOwnerIdRef.current;
      
        try {
          setSelectedCalendarDate("");
          setGardenError("");
      
   
          if (
            previousGardenOwnerId &&
            String(previousGardenOwnerId) !==
              String(currentUser.id)
          ) {
            await apiRequest("/leave", {
              method: "POST",
              body: JSON.stringify({
                hostUserId:
                  previousGardenOwnerId,
                visitorUserId:
                  currentUser.id,
                visitorAvatar:
                  currentUser.avatar || "🦋"
              })
            });
          }
      
          viewedGardenOwnerIdRef.current =
            currentUser.id;
      
          socketRef.current?.emit(
            "join-garden",
            currentUser.id
          );
      
          await loadGarden(currentUser.id);
        } catch (error) {
          console.error(
            "Leave garden error:",
            error
          );
      
          setGardenError(
            error.message ||
              "Failed to leave the garden."
          );
        }
      }
  
    async function handleBloom({
      event,
      mood
    }) {
      if (!currentUser?.id) {
        throw new Error(
          "Please log in first."
        );
      }
  
      const newFlower =
        await apiRequest(
          `/users/${encodeURIComponent(
            currentUser.id
          )}/flowers`,
          {
            method: "POST",
  
            body: JSON.stringify({
              mood,
              event
            })
          }
        );

      await loadSession();
  
      setSelectedCalendarDate("");
  
      return newFlower;
    }
  
    async function handleDeleteFlower(
      flowerId
    ) {
      if (!currentUser?.id) {
        throw new Error(
          "Please log in first."
        );
      }
  
      if (!isOwnGarden) {
        throw new Error(
          "You can only delete flowers from your own garden."
        );
      }
  
      await apiRequest(
        `/users/${encodeURIComponent(
          currentUser.id
        )}/flowers/${encodeURIComponent(
          flowerId
        )}`,
        {
          method: "DELETE"
        }
      );
  
      setGardenData((current) => ({
        ...current,
  
        flowers: current.flowers.filter(
          (flower) =>
            String(flower.id) !==
            String(flowerId)
        )
      }));
    }
  
    return (
      <>
        <header>
          <h1>PetalPal</h1>
  
          <p>
            A social mood garden where
            emotions bloom into flowers.
          </p>
        </header>
  
        <main>
          <div className="game-layout">
            <div className="left-panel">
              {!isLoggedIn ? (
                <section id="authSection">
                  <div className="auth-heading">
                    <span className="auth-heading-icon">
                      🌸
                    </span>
  
                    <div>
                      <p className="auth-eyebrow">
                        WELCOME TO YOUR GARDEN
                      </p>
  
                      <h2>
                        Welcome to PetalPal
                      </h2>
  
                      <p className="auth-subtitle">
                        Log in to continue
                        growing your mood garden.
                      </p>
                    </div>
                  </div>
  
                  {!isAwaitingEmailVerification && !pendingProfileEmail && <div className="auth-tabs">
                    <button
                      id="showLoginBtn"
                      className={`auth-tab ${
                        activeAuthTab ===
                        "login"
                          ? "active"
                          : ""
                      }`}
                      type="button"
                      onClick={() =>
                        setActiveAuthTab(
                          "login"
                        )
                      }
                    >
                      Log In
                    </button>
  
                    <button
                      id="showRegisterBtn"
                      className={`auth-tab ${
                        activeAuthTab ===
                        "register"
                          ? "active"
                          : ""
                      }`}
                      type="button"
                      onClick={() =>
                        setActiveAuthTab(
                          "register"
                        )
                      }
                    >
                      Create Account
                    </button>
                  </div>}
  
                  {pendingProfileEmail ? (
                    <CompleteProfileForm
                      email={pendingProfileEmail}
                      authMethod={pendingProfileAuthMethod}
                      onComplete={(user) => handleLogin(user)}
                      onCancel={handleLogout}
                    />
                  ) : activeAuthTab ===
                  "login" ? (
                    <LoginForm
                      onLogin={handleLogin}
                    />
                  ) : (
                    <RegisterForm
                      onVerified={handleLogin}
                      onRequireLogin={() => {
                        setIsAwaitingEmailVerification(false);
                        setActiveAuthTab("login");
                      }}
                      onVerificationStateChange={setIsAwaitingEmailVerification}
                    />
                  )}
                </section>
              ) : (
                <>
                  <CurrentProfile
                    user={currentUser}
                    onLogout={handleLogout}
                  />

                  {experience.loading ? (
                    <p className="garden-status-message">
                      Restoring your garden...
                    </p>
                  ) : !experience.fairyState?.onboardingCompleted ? (
                    <OnboardingFlow
                      fairyState={experience.fairyState}
                      onAdvance={handleOnboardingAdvance}
                      onBloom={handleBloom}
                      disabled={gardenLoading}
                    />
                  ) : (
                    <DailyCheckIn
                      onBloom={handleBloom}
                      completed={experience.hasCheckedInToday}
                      disabled={gardenLoading || !isOwnGarden}
                    />
                  )}
  
                  <VisitorForm
                    currentUser={currentUser}
                    onAvatarChange={
                      handleAvatarChange
                    }
                  />
  
                  <FriendSearch
                    key={`friend-search-${friendRefreshVersion}`}
                    currentUser={currentUser}
                  />
  
                  <FriendList
                    key={`friend-list-${friendRefreshVersion}`}
                    currentUser={currentUser}
                    onVisitFriend={
                      handleVisitFriend
                    }
                  />
  
                  <FriendRequests
                    key={`friend-requests-${friendRefreshVersion}`}
                    currentUser={currentUser}
                  />
  
                  <section id="friendSection">
                    <h2>
                      Garden Visiting
                    </h2>
  
                    <button
                      id="backMyGardenBtn"
                      type="button"
                      disabled={
                        gardenLoading ||
                        isOwnGarden
                      }
                      onClick={
                        handleBackToMyGarden
                      }
                    >
                      {isOwnGarden
                        ? "You Are in Your Garden"
                        : "Back to My Garden"}
                    </button>
                  </section>
                </>
              )}
            </div>
  
            <div className="right-panel">
              {!isLoggedIn ? (
                <WelcomePanel />
              ) : (
                <div id="gardenAppContent">
                  {gardenLoading &&
                    gardenData.flowers
                      .length === 0 && (
                      <p className="garden-status-message">
                        Loading your garden...
                      </p>
                    )}
  
                  {gardenError && (
                    <div className="garden-error-message">
                      <p>{gardenError}</p>
  
                      <button
                        type="button"
                        onClick={() =>
                          loadGarden(
                            gardenData.owner?.id ||
                              currentUser.id
                          )
                        }
                      >
                        Try Again
                      </button>
                    </div>
                  )}
  
                  <GardenScene
                    owner={
                      gardenData.owner ||
                      currentUser
                    }
                    currentUser={currentUser}
                    socket={socketRef.current}
                    flowers={
                      gardenData.flowers
                    }
                    activeVisitors={
                      gardenData.activeVisitors
                    }
                    isOwnGarden={
                      isOwnGarden
                    }
                    highlightedDate={
                      selectedCalendarDate
                    }
                    onDeleteFlower={
                      handleDeleteFlower
                    }
                  />
  
                  <div className="below-garden-layout">
                    <Calendar
                      flowers={
                        gardenData.flowers
                      }
                      selectedDate={
                        selectedCalendarDate
                      }
                      onSelectDate={
                        setSelectedCalendarDate
                      }
                    />
  
                    <FriendStatus
                      currentUser={currentUser}
                      gardenOwner={
                        gardenData.owner ||
                        currentUser
                      }
                      isOwnGarden={
                        isOwnGarden
                      }
                    />
  
                    <VisitorRecords
                      records={
                        gardenData.visitRecords
                      }
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </>
    );
  }
  
  export default App;
