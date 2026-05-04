import axios from "axios";
import { CameraView, Camera } from "expo-camera";
import { useEffect, useRef, useState } from "react";
import {
  Text,
  View,
  Modal,
  Image,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import { Picker } from "@react-native-picker/picker";

const config = require("../../apiConfig.json");

export default function HomeScreen() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const cameraRef = useRef<any>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const [studentData, setStudentData] = useState<any>(null);
  const [purpose, setPurpose] = useState("");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [savedData, setSavedData] = useState<any>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [serverStatus, setServerStatus] = useState("checking");

  // CAMERA PERMISSION
  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === "granted");
    })();
  }, []);

  // SERVER CHECK FUNCTION
  const checkServer = async () => {
    if (serverStatus === "checking") return;

    try {
      setServerStatus("checking");
      await axios.get(`${config.API_BASE}`, { timeout: 5000 });
      setServerStatus("online");
    } catch {
      setServerStatus("offline");
    }
  };

  // AUTO CHECK
  useEffect(() => {
    const init = async () => {
      try {
        await axios.get(`${config.API_BASE}`, { timeout: 5000 });
        setServerStatus("online");
      } catch {
        setServerStatus("offline");
      }
    };

    init();
    const interval = setInterval(checkServer, 10000);
    return () => clearInterval(interval);
  }, []);

  // CAMERA AUTO STOP
  useEffect(() => {
    let timer: any;
    if (cameraActive) {
      timer = setTimeout(() => {
        setCameraActive(false);
        setIsScanning(false);
      }, 20000);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [cameraActive]);

  const takePhoto = async () => {
    if (!cameraRef.current || isScanning) return;
    setIsScanning(true);

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        base64: true,
      });

      setPhotoUri(photo.uri);

      const response = await axios.post(
        `${config.API_BASE}/api/recognize-face`,
        { image: photo.base64 },
        { timeout: 15000 }
      );

      const data = response.data;

      if (data.status === "BLOCKED") {
        Alert.alert("Blocked", data.message);
        return;
      }

      if (data.status !== "SUCCESS") {
        Alert.alert("Verification Failed", data.message);
        return;
      }

      setStudentData(data);
      setShowModal(true);
    } catch {
      Alert.alert("Error", "Backend not reachable");
    } finally {
      setIsScanning(false);
    }
  };

  const confirmEntryExit = async () => {
    if (isSubmitting || !studentData) return;

    if (studentData.action === "EXIT" && !purpose) {
      Alert.alert("Select Purpose", "Please select purpose");
      return;
    }

    setIsSubmitting(true);

    try {
      await axios.post(
        `${config.API_BASE}/api/confirm-entry-exit`,
        {
          student: studentData.student,
          action: studentData.action,
          purpose: studentData.action === "EXIT" ? purpose : null,
        },
        { timeout: 15000 }
      );

      const timeNow = new Date().toLocaleString();

      setSavedData({
        ...studentData.student,
        action: studentData.action,
        purpose:
          studentData.action === "EXIT"
            ? purpose
            : studentData.last_exit?.purpose,
        outTime:
          studentData.action === "EXIT"
            ? timeNow
            : studentData.last_exit?.outTime,
        inTime: studentData.action === "ENTRY" ? timeNow : null,
      });

      setShowModal(false);
      setShowSuccessModal(true);
      setPurpose("");
    } catch {
      Alert.alert("Error", "Failed to save entry / exit");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (hasPermission === null)
    return <Text>Requesting camera permission...</Text>;
  if (hasPermission === false) return <Text>No access to camera</Text>;

  return (
    <View style={{ flex: 1 }}>
      {/* HEADER */}
      <View style={styles.header}>
        <Image source={require("./iiitdmj_logo.jpg")} style={styles.logo} />

        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>
            PDPM IIITDMJ Entry–Exit App
          </Text>

          <View style={styles.subRow}>
            <Text style={styles.headerSubtitle}>
              Student Monitoring System
            </Text>

            <View style={styles.statusRow}>
              <Text
                style={[
                  styles.statusText,
                  serverStatus === "online"
                    ? { color: "lightgreen" }
                    : serverStatus === "offline"
                    ? { color: "red" }
                    : { color: "yellow" },
                ]}
              >
                ●{" "}
                {serverStatus === "checking"
                  ? "Checking..."
                  : serverStatus === "online"
                  ? "Online"
                  : "Offline"}
              </Text>

              <TouchableOpacity
                onPress={checkServer}
                disabled={serverStatus === "checking"}
              >
                <Text style={styles.retry}>↻</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>

      {/* CAMERA CONTROL */}
      {cameraActive ? (
        <>
          <CameraView ref={cameraRef} style={{ flex: 1 }} facing="front" />

          <TouchableOpacity
            style={[styles.scanBtn, isScanning && { opacity: 0.6 }]}
            disabled={isScanning}
            onPress={takePhoto}
          >
            <Text style={styles.scanText}>
              {isScanning ? "SCANNING..." : "CLICK HERE TO SCAN YOUR FACE"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.stopBtn}
            onPress={() => setCameraActive(false)}
          >
            <Text style={styles.btnText}>Stop Camera</Text>
          </TouchableOpacity>
        </>
      ) : (
        <View style={styles.startContainer}>
          <TouchableOpacity
            style={[
              styles.startBtn,
              serverStatus !== "online" && { opacity: 0.5 },
            ]}
            disabled={serverStatus !== "online"}
            onPress={() => {
              if (serverStatus === "online") setCameraActive(true);
              else Alert.alert("Server Offline", "Tap ↻ to retry connection");
            }}
          >
            <Text style={styles.btnText}>
              {serverStatus === "checking"
                ? "Checking..."
                : serverStatus === "online"
                ? "Start Camera"
                : "Server Offline"}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* VERIFY MODAL */}
      <Modal visible={showModal} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.modalBox}>
            <Text style={styles.title}>Student Verification</Text>

            {photoUri && (
              <Image source={{ uri: photoUri }} style={styles.photo} />
            )}

            <Text>
              <Text style={styles.label}>Name : </Text>
              {studentData?.student?.name}
            </Text>
            <Text>
              <Text style={styles.label}>Roll : </Text>
              {studentData?.student?.roll_no}
            </Text>
            <Text>
              <Text style={styles.label}>Status : </Text>
              {studentData?.action}
            </Text>

            {studentData?.action === "ENTRY" && (
              <>
                <Text>
                  <Text style={styles.label}>Last Exit Time : </Text>
                  {studentData?.last_exit?.outTime || "N/A"}
                </Text>

                <Text>
                  <Text style={styles.label}>Last Exit Purpose : </Text>
                  {studentData?.last_exit?.purpose || "N/A"}
                </Text>
              </>
            )}

            {studentData?.action === "EXIT" && (
              <Picker
                selectedValue={purpose}
                onValueChange={(value) => setPurpose(value)}
              >
                <Picker.Item label="Select Purpose" value="" />
                <Picker.Item label="Tea Break" value="Tea Break" />
                <Picker.Item label="Market" value="Market" />
                <Picker.Item label="Hospital" value="Hospital" />
                <Picker.Item label="Official Work" value="Official Work" />
                <Picker.Item label="Vacation" value="Vacation" />
              </Picker>
            )}

            <View style={styles.btnRow}>
              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={confirmEntryExit}
              >
                <Text style={styles.btnText}>Confirm</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setShowModal(false)}
              >
                <Text style={styles.btnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* SUCCESS MODAL */}
      <Modal visible={showSuccessModal} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.modalBox}>
            <Text style={styles.successTitle}>
              Entry / Exit Saved Successfully
            </Text>

            <Text>
              <Text style={styles.label}>Name : </Text>
              {savedData?.name}
            </Text>

            <Text>
              <Text style={styles.label}>Roll : </Text>
              {savedData?.roll_no}
            </Text>

            {savedData?.action === "ENTRY" && (
              <>
                <Text>
                  <Text style={styles.label}>Last Exit Time : </Text>
                  {savedData?.outTime || "N/A"}
                </Text>

                <Text>
                  <Text style={styles.label}>Last Exit Purpose : </Text>
                  {savedData?.purpose || "N/A"}
                </Text>

                <Text>
                  <Text style={styles.label}>Entry Time : </Text>
                  {savedData?.inTime}
                </Text>
              </>
            )}

            {savedData?.action === "EXIT" && (
              <>
                <Text>
                  <Text style={styles.label}>Exit Time : </Text>
                  {savedData?.outTime}
                </Text>

                <Text>
                  <Text style={styles.label}>Purpose : </Text>
                  {savedData?.purpose}
                </Text>
              </>
            )}

            <TouchableOpacity
              style={styles.okBtn}
              onPress={() => setShowSuccessModal(false)}
            >
              <Text style={styles.btnText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  scanBtn: { backgroundColor: "#0a3d62", padding: 15, alignItems: "center" },
  scanText: { color: "#fff", fontWeight: "bold" },

  startContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  startBtn: {
    backgroundColor: "#0a3d62",
    padding: 15,
    borderRadius: 10,
  },

  stopBtn: {
    backgroundColor: "#e74c3c",
    padding: 10,
    alignItems: "center",
  },

  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },

  modalBox: {
    width: "90%",
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 10,
  },

  title: {
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 10,
  },

  successTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "green",
    textAlign: "center",
    marginBottom: 15,
  },

  label: { fontWeight: "bold" },

  photo: {
    width: 200,
    height: 200,
    alignSelf: "center",
    marginBottom: 10,
    borderRadius: 10,
  },

  btnRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },

  confirmBtn: {
    backgroundColor: "green",
    padding: 10,
    borderRadius: 5,
    width: "45%",
    alignItems: "center",
  },

  cancelBtn: {
    backgroundColor: "red",
    padding: 10,
    borderRadius: 5,
    width: "45%",
    alignItems: "center",
  },

  okBtn: {
    backgroundColor: "#0a3d62",
    padding: 10,
    borderRadius: 5,
    marginTop: 15,
    alignItems: "center",
  },

  btnText: { color: "#fff", fontWeight: "bold" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0a3d62",
    paddingTop: 40,
    paddingBottom: 10,
    paddingHorizontal: 10,
  },

  logo: {
    width: 45,
    height: 40,
    marginRight: 10,
    resizeMode: "contain",
    borderRadius: 10,
  },

  headerTitle: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },

  headerSubtitle: {
    color: "#ccc",
    fontSize: 12,
  },

  subRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  statusRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  statusText: {
    fontSize: 12,
    fontWeight: "bold",
  },

  retry: {
    color: "#fff",
    fontSize: 16,
    marginLeft: 8,
  },
});