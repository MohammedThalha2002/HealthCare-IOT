import { useEffect, useState } from "react";
import { cloneDeep } from "lodash";

import { useSocket } from "@/context/socket";
import usePeer from "@/hooks/usePeer";
import useMediaStream from "@/hooks/useMediaStream";
import usePlayer from "@/hooks/usePlayer";

import Player from "@/component/Player";
import Bottom from "@/component/Bottom";
import CopySection from "@/component/CopySection";

import styles from "@/styles/room.module.css";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";
const GaugeChart = dynamic(() => import("react-gauge-chart"), { ssr: false });
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";
import { db } from "@/config/firebaseConfig";
import { onValue, ref, set } from "firebase/database";

const Room = () => {
  const socket = useSocket();
  const { roomId } = useRouter().query;
  const { peer, myId } = usePeer();
  const { stream } = useMediaStream();
  const {
    players,
    setPlayers,
    playerHighlighted,
    nonHighlightedPlayers,
    toggleAudio,
    toggleVideo,
    leaveRoom,
  } = usePlayer(myId, roomId, peer);

  const [users, setUsers] = useState([]);
  //
  const [temperature, setTemperature] = useState(0);
  const [spo2, setSpo2] = useState(0);
  const [heartRate, setHeartRate] = useState(0);
  const [ecg, setECG] = useState([
    [0, 0],
    [1, 5],
  ]);

  useEffect(() => {
    const query = ref(db, "health");
    return onValue(query, (snapshot) => {
      if (snapshot.exists()) {
        const res = snapshot.val();
        console.log(res);
        setTemperature(res.temperature);
        setHeartRate(res.beatsPerMinute);
        setSpo2(res.spo2);
        const index = ecg[ecg.length - 1][0] + 1;
        setECG([...ecg, [index, res.ecg]]);
      }
    });
  }, []);

  useEffect(() => {
    if (!socket || !peer || !stream) return;
    const handleUserConnected = (newUser) => {
      console.log(`user connected in room with userId ${newUser}`);

      const call = peer.call(newUser, stream);

      call.on("stream", (incomingStream) => {
        console.log(`incoming stream from ${newUser}`);
        setPlayers((prev) => ({
          ...prev,
          [newUser]: {
            url: incomingStream,
            muted: true,
            playing: true,
          },
        }));

        setUsers((prev) => ({
          ...prev,
          [newUser]: call,
        }));
      });
    };
    socket.on("user-connected", handleUserConnected);

    return () => {
      socket.off("user-connected", handleUserConnected);
    };
  }, [peer, setPlayers, socket, stream]);

  useEffect(() => {
    if (!socket) return;
    const handleToggleAudio = (userId) => {
      console.log(`user with id ${userId} toggled audio`);
      setPlayers((prev) => {
        const copy = cloneDeep(prev);
        copy[userId].muted = !copy[userId].muted;
        return { ...copy };
      });
    };

    const handleToggleVideo = (userId) => {
      console.log(`user with id ${userId} toggled video`);
      setPlayers((prev) => {
        const copy = cloneDeep(prev);
        copy[userId].playing = !copy[userId].playing;
        return { ...copy };
      });
    };

    const handleUserLeave = (userId) => {
      console.log(`user ${userId} is leaving the room`);
      users[userId]?.close();
      const playersCopy = cloneDeep(players);
      delete playersCopy[userId];
      setPlayers(playersCopy);
    };
    socket.on("user-toggle-audio", handleToggleAudio);
    socket.on("user-toggle-video", handleToggleVideo);
    socket.on("user-leave", handleUserLeave);
    return () => {
      socket.off("user-toggle-audio", handleToggleAudio);
      socket.off("user-toggle-video", handleToggleVideo);
      socket.off("user-leave", handleUserLeave);
    };
  }, [players, setPlayers, socket, users]);

  useEffect(() => {
    if (!peer || !stream) return;
    peer.on("call", (call) => {
      const { peer: callerId } = call;
      call.answer(stream);

      call.on("stream", (incomingStream) => {
        console.log(`incoming stream from ${callerId}`);
        setPlayers((prev) => ({
          ...prev,
          [callerId]: {
            url: incomingStream,
            muted: true,
            playing: true,
          },
        }));

        setUsers((prev) => ({
          ...prev,
          [callerId]: call,
        }));
      });
    });
  }, [peer, setPlayers, stream]);

  useEffect(() => {
    if (!stream || !myId) return;
    console.log(`setting my stream ${myId}`);
    setPlayers((prev) => ({
      ...prev,
      [myId]: {
        url: stream,
        muted: true,
        playing: true,
      },
    }));
  }, [myId, setPlayers, stream]);

  const chartOptions = {
    title: {
      text: "ECG",
    },
    xAxis: {
      title: {
        text: "Time (sec)", // x-axis title
      },
    },
    yAxis: {
      title: {
        text: "ECG", // y-axis title
      },
    },
    credits: {
      enabled: false,
    },
    series: [
      {
        data: ecg,
      },
    ],
  };

  return (
    <div className="w-full h-screen flex overflow-hidden">
      <div className="relative h-screen w-[60%]">
        {/* Main Video */}
        <div className={styles.activePlayerContainer}>
          {playerHighlighted && (
            <Player
              url={playerHighlighted.url}
              muted={playerHighlighted.muted}
              playing={playerHighlighted.playing}
              isActive
            />
          )}
        </div>
        {/* Other Video */}
        <div className={styles.inActivePlayerContainer}>
          {Object.keys(nonHighlightedPlayers).map((playerId) => {
            const { url, muted, playing } = nonHighlightedPlayers[playerId];
            return (
              <Player
                key={playerId}
                url={url}
                muted={muted}
                playing={playing}
                isActive={false}
              />
            );
          })}
        </div>
        <CopySection roomId={roomId} />
        <Bottom
          muted={playerHighlighted?.muted}
          playing={playerHighlighted?.playing}
          toggleAudio={toggleAudio}
          toggleVideo={toggleVideo}
          leaveRoom={leaveRoom}
        />
      </div>
      <div className="w-[40%] h-screen bg-black flex flex-wrap items-center">
        <div className="h-[20vh] w-[20vw] mt-4 bg-[#f6f6f6] rounded-md drop-shadow-lg shadow-slate-600 flex flex-col justify-center items-center ">
          <GaugeChart
            id="gauge-chart5"
            nrOfLevels={420}
            arcsLength={[0.3, 0.5, 0.2]}
            colors={["#5BE12C", "#F5CD19", "#EA4228"]}
            percent={temperature / 100}
            formatTextValue={(val) => val + "°C"}
            arcPadding={0.02}
            textColor=""
          />
          <h3 className="font-semibold text-black">Temeprature</h3>
        </div>
        <div className="h-[20vh] w-[20vw] mt-4 bg-[#f6f6f6] rounded-md drop-shadow-lg shadow-slate-600 flex flex-col justify-center items-center ">
          <GaugeChart
            id="gauge-chart5"
            nrOfLevels={420}
            arcsLength={[0.3, 0.5, 0.2]}
            colors={["#5BE12C", "#F5CD19", "#EA4228"]}
            percent={heartRate / 100}
            formatTextValue={(val) => val + "°C"}
            arcPadding={0.02}
            textColor=""
          />
          <h3 className="font-semibold text-black">HeartRate</h3>
        </div>
        <div className="h-[20vh] w-[20vw] mt-4 bg-[#f6f6f6] rounded-md drop-shadow-lg shadow-slate-600 flex flex-col justify-center items-center ">
          <GaugeChart
            id="gauge-chart5"
            nrOfLevels={420}
            arcsLength={[0.3, 0.5, 0.2]}
            colors={["#5BE12C", "#F5CD19", "#EA4228"]}
            percent={spo2 / 100}
            formatTextValue={(val) => val + "°C"}
            arcPadding={0.02}
            textColor=""
          />
          <h3 className="font-semibold text-black">SPO2</h3>
        </div>
        <div className="w-[40vw] mr-1">
          <HighchartsReact highcharts={Highcharts} options={chartOptions} />
        </div>
      </div>
    </div>
  );
};

export default Room;
