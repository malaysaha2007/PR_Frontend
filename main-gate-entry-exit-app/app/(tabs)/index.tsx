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
  ActivityIndicator,
  Animated,
  Easing,
    ScrollView,
} from "react-native";


import { Picker } from "@react-native-picker/picker";
import { Audio } from "expo-av";
import { COLORS } from "../../theme";

import * as Linking from "expo-linking";

import API_BASE from "../../config";


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

  const [showWaitingModal, setShowWaitingModal] = useState(false);
const [waitingMessage, setWaitingMessage] = useState("");
const [pollingActive, setPollingActive] = useState(false);
const [gateApproved, setGateApproved] = useState(false);
const [gateVerified, setGateVerified] = useState(false);

  const [alarmSound, setAlarmSound] = useState<any>(null);

  const scanAnimation = useRef(new Animated.Value(0)).current;

  const animation = useRef<any>(null);

  // CAMERA PERMISSION
  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === "granted");
    })();
  }, []);


  useEffect(() => {
  Animated.loop(
    Animated.sequence([
      Animated.timing(scanAnimation, {
        toValue: 1,
        duration: 1800,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
      Animated.timing(scanAnimation, {
        toValue: 0,
        duration: 1800,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ])
  ).start();
}, []);

useEffect(() => {

  if (!cameraActive) {

    scanAnimation.setValue(0);

    animation.current = Animated.loop(
      Animated.timing(scanAnimation,{
        toValue:1,
        duration:3000,
        useNativeDriver:true,
      })
    );

    animation.current.start();

  }

  return () => {

    animation.current?.stop();

  };

},[cameraActive]);

  // SERVER CHECK FUNCTION
  const checkServer = async () => {
    if (serverStatus === "checking") return;

    try {
      setServerStatus("checking");
      await axios.get(`${API_BASE}`, { timeout: 5000 });
      setServerStatus("online");
    } catch {
      setServerStatus("offline");
    }
  };

  // AUTO CHECK
  useEffect(() => {
    const init = async () => {
      try {
        await axios.get(`${API_BASE}`, { timeout: 5000 });
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
        `${API_BASE}/api/recognize-face`,
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

const playAlarm = async () => {
  try {

    if (alarmSound) {
      await alarmSound.stopAsync();
      await alarmSound.unloadAsync();
    }

    const { sound } = await Audio.Sound.createAsync(
      require("../../assets/images/alarm.wav")
    );

    setAlarmSound(sound);

    await sound.playAsync();

  } catch (e) {
    console.log("Alarm Error:", e);
  }
};

const stopAlarm = async () => {
  try {
    if (alarmSound) {
      await alarmSound.stopAsync();
      await alarmSound.unloadAsync();
      setAlarmSound(null);
    }
  } catch (e) {
    console.log("Stop Alarm Error:", e);
  }
};

const startPollingForGateApproval = async (
  rollNo: string
) => {

  setPollingActive(true);

  const startTime = Date.now();

const interval = setInterval(async () => {

  try {

    const response = await axios.get(
      `${API_BASE}/check-vacation/${rollNo}`
    );

    const vacationData = response.data;
   

    if (Date.now() - startTime > 120000) {

  clearInterval(interval);

  setPollingActive(false);

  setShowWaitingModal(false);

  Alert.alert(
    "Timeout",
    "No response received from Gate Guard. Please contact the Main Gate Office."
  );

  return;
}

if (
  vacationData.status ===
  "WAITING_FOR_GATE_APPROVAL"
) {
  return;
}


if (
  vacationData.status ===
  "APPROVED_BY_GATE"
) {


  setGateVerified(true);

setGateApproved(true);


  clearInterval(interval);

  setPollingActive(false);

 setShowWaitingModal(false);

setGateVerified(true);
setGateApproved(true);
  return;
}


if (
  vacationData.status ===
  "DENIED_BY_GATE"
) {

  clearInterval(interval);

  setPollingActive(false);

  setShowWaitingModal(false);

  await playAlarm();

  Alert.alert(
    "Request Denied",
    "Your vacation request was denied by the Gate Guard.",
    [
      {
        text: "OK",
        onPress: async () => {
          await stopAlarm();
        },
      },
    ]
  );

  return;
}

  } catch (error) {
    console.log("Polling Error:", error);
  }

}, 5000);

};

useEffect(() => {
  return () => {
    if (alarmSound) {
      alarmSound.unloadAsync();
    }
  };
}, [alarmSound]);


const saveApprovedVacationExit = async () => {

  try {

    const response = await axios.post(
      `${API_BASE}/api/confirm-entry-exit`,
      {
        student: studentData.student,
        action: studentData.action,
        purpose: purpose,
      },
      { timeout: 15000 }
    );

    const timeNow = new Date().toLocaleString();

    setSavedData({
      ...studentData.student,
      action: studentData.action,
      purpose: purpose,
      outTime: timeNow,
      inTime: null,
      message: response.data.message,
    });

    setShowSuccessModal(true);
    setPurpose("");
setGateApproved(false);
setShowModal(false);


  }catch (error: any) {

    console.log("ENTRY/EXIT ERROR");

    console.log(error.response?.data);

    console.log(error.response?.status);

    console.log(error.message);

    Alert.alert(
        "Error",
        error.response?.data?.message || error.message
    );
}

};


  const confirmEntryExit = async () => {

    
    
    if (isSubmitting || !studentData) return;

    if (studentData.action === "EXIT" && !purpose) {
      Alert.alert("Select Purpose", "Please select purpose");
      return;
    }
    

   if (
  studentData.action === "EXIT" &&
  purpose === "Vacation" &&
  !gateVerified
) {

  const vacationCheck =
    await axios.get(
      `${API_BASE}/check-vacation/${studentData.student.roll_no}`
    );

  const vacationData =
    vacationCheck.data;

  if (!vacationData.allowed) {

    Alert.alert(
      "Vacation Denied",
      vacationData.message ||
      "Hostel approval not found"
    );

    return;
  }

 if (
  vacationData.status ===
  "WAITING_FOR_GATE_APPROVAL"
) {

  setShowWaitingModal(true);

  startPollingForGateApproval(
    studentData.student.roll_no
  );

  return;
}

  if (
    vacationData.gate_status !==
    "Approved"
  ) {

    Alert.alert(
      "Waiting",
      "Waiting for gate guard approval"
    );

    return;
  }
}

    setIsSubmitting(true);

    try {
   const response = await axios.post(
  `${API_BASE}/api/confirm-entry-exit`,
  {
    student: studentData.student,
    action: studentData.action,
    purpose: studentData.action === "EXIT" ? purpose : null,
  },
  { timeout: 15000 }
);

const data = response.data;


if (data.status === "DENIED") {
  Alert.alert("Vacation Denied", data.message);
  return;
}
      const timeNow = new Date().toLocaleString();

      setSavedData({
        ...studentData.student,
        action: studentData.action,
          message: data.message,
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
      setGateVerified(false);
      setPurpose("");
    } catch (error: any) {

if (
  error.response &&
  error.response.data &&
  error.response.data.status === "DENIED"
) {

 await playAlarm();

Alert.alert(
  "Vacation Denied",
  error.response.data.message,
  [
    {
      text: "OK",
      onPress: async () => {
        await stopAlarm();
      },
    },
  ]
);

return;
}

  Alert.alert(
    "Error",
    "Failed to save entry / exit"
  );
}finally {
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
            VisionGate App
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

          <View style={styles.captureContainer}>

  <Text style={styles.scanHint}>
    {isScanning
      ? "Scanning Face..."
      : "Tap the button to scan"}
  </Text>

  <TouchableOpacity
    disabled={isScanning}
    onPress={takePhoto}
    style={styles.captureOuter}
  >
    <View
      style={[
        styles.captureInner,
        isScanning && styles.captureScanning,
      ]}
    />
  </TouchableOpacity>

</View>

          <TouchableOpacity
            style={styles.stopBtn}
            onPress={() => setCameraActive(false)}
          >
            <Text style={styles.btnText}>Stop Camera</Text>
          </TouchableOpacity>
        </>
      ) : (

        <ScrollView
  contentContainerStyle={styles.startContainer}
  showsVerticalScrollIndicator={false}
>

<View style={styles.scanContainer}>

  <Image
    source={require("../../assets/images/wireframe.png")}
    style={styles.heroImage}
  />

<Animated.View
    style={[
        styles.scanGlowLarge,
        {
            transform:[
                {
                    translateY: scanAnimation.interpolate({
                        inputRange:[0,1],
                        outputRange:[-20,230],
                    }),
                },
            ],
        },
    ]}
/>

<Animated.View
    style={[
        styles.scanGlow,
        {
            transform:[
                {
                    translateY: scanAnimation.interpolate({
                        inputRange:[0,1],
                        outputRange:[-20,230],
                    }),
                },
            ],
        },
    ]}
/>

<Animated.View
    style={[
        styles.scanLine,
        {
            transform:[
                {
                    translateY: scanAnimation.interpolate({
                        inputRange:[0,1],
                        outputRange:[-20,230],
                    }),
                },
            ],
        },
    ]}
/>

</View>



  <Text style={styles.heroTitle}>
    VisionGate
  </Text>

  <Text style={styles.heroSubtitle}>
    AI Powered Smart Entry & Exit
  </Text>

 

  <View style={styles.featureContainer}>

    

    <View style={styles.featureCard}>
      <Text style={styles.featureIcon}>🧠</Text>
      <Text style={styles.featureText}>
        AI Face Recognition
      </Text>
    </View>

    <View style={styles.featureCard}>
      <Text style={styles.featureIcon}>🔒</Text>
      <Text style={styles.featureText}>
        Secure Verification
      </Text>
    </View>

<TouchableOpacity
  style={styles.featureCard}
  onPress={() =>
    Linking.openURL("https://vision-gate-sbta.vercel.app")
  }
>
  <Text style={styles.featureIcon}>🌐</Text>

  <Text style={styles.featureText}>
    Visit VisionGate Web Portal
  </Text>
</TouchableOpacity>

    

  </View>

  <TouchableOpacity
    style={[
      styles.startBtn,
      serverStatus !== "online" && { opacity: 0.5 },
    ]}
    disabled={serverStatus !== "online"}
    onPress={() => {
      if (serverStatus === "online")
        setCameraActive(true);
      else
        Alert.alert(
          "Server Offline",
          "Tap ↻ to retry connection"
        );
    }}
  >
    <Text style={styles.btnText}>
      📷 Scan Face
    </Text>
  </TouchableOpacity>

  <Text style={styles.footer}>
Version 1.0 • IIITDM Jabalpur
</Text>

</ScrollView>
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
  onPress={async () => {
    await stopAlarm();
    setShowModal(false);
  }}
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


        
         <View style={styles.successCard}>

 <Image
    source={{
        uri:
            savedData?.photo ||
            studentData?.student?.photo
    }}
    style={styles.studentPhoto}
/>

  <Text style={styles.successHeading}>
    {savedData?.action === "ENTRY"
      ? "ENTRY SUCCESS"
      : "EXIT SUCCESS"}
  </Text>

  <View style={styles.divider} />

  <Text style={styles.welcome}>
    {savedData?.action === "ENTRY"
      ? "WELCOME BACK,"
      : "HAVE A SAFE TRIP"}
  </Text>

  <Text style={styles.studentName}>
    {savedData?.name}
  </Text>

  <Text style={styles.rollNumber}>
    {savedData?.roll_no}
  </Text>

  <View style={styles.divider} />

  {savedData?.action === "ENTRY" ? (
    <>
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Status</Text>
        <Text style={styles.statusBadge}>
          INSIDE CAMPUS
        </Text>
      </View>

      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Purpose</Text>
        <Text style={styles.infoValue}>
          {savedData?.purpose || "-"}
        </Text>
      </View>

      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Exit Time</Text>
        <Text style={styles.infoValue}>
          {savedData?.outTime || "-"}
        </Text>
      </View>

      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Entry Time</Text>
        <Text style={styles.infoValue}>
          {savedData?.inTime || "-"}
        </Text>
      </View>
    </>
  ) : (
    <>
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Status</Text>
       <Text
  style={[
    styles.statusBadge,
    savedData?.action === "EXIT"
      ? styles.outsideStatus
      : styles.insideStatus,
  ]}
>
  {savedData?.action === "EXIT"
    ? "OUTSIDE CAMPUS"
    : "INSIDE CAMPUS"}
</Text>
      </View>

      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Purpose</Text>
        <Text style={styles.infoValue}>
          {savedData?.purpose}
        </Text>
      </View>

      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Exit Time</Text>
        <Text style={styles.infoValue}>
          {savedData?.outTime || "-"}
        </Text>
      </View>
    </>
  )}

  <View style={styles.divider} />

  <TouchableOpacity
    style={styles.doneButton}
    onPress={() => setShowSuccessModal(false)}
  >
    <Text style={styles.doneText}>
      DONE
    </Text>
  </TouchableOpacity>

</View>



        </View>
      </Modal>

      <Modal
  visible={showWaitingModal}
  transparent
  animationType="fade"
>
  <View style={styles.overlay}>
    <View style={styles.modalBox}>

      <Text style={styles.title}>
        Waiting For Approval
      </Text>

      <Text style={{ textAlign: "center", marginTop: 10 }}>
        {studentData?.student?.name}
      </Text>

      <Text style={{ textAlign: "center" }}>
  {studentData?.student?.roll_no}
</Text>

<ActivityIndicator
  size="large"
  style={{ marginTop: 20 }}
/>

<Text
  style={{
    textAlign: "center",
    marginTop: 20,
    fontWeight: "bold",
  }}
>
  Waiting for Gate Guard Approval...
</Text>
    </View>
  </View>
</Modal>


{/* GATE APPROVED MODAL */}
<Modal
  visible={gateApproved}
  transparent
  animationType="fade"
>
  <View style={styles.overlay}>
    <View style={styles.modalBox}>

      <Text style={styles.successTitle}>
        Gate Verification Completed
      </Text>

      <Text>
        <Text style={styles.label}>Name : </Text>
        {studentData?.student?.name}
      </Text>

      <Text>
        <Text style={styles.label}>Roll : </Text>
        {studentData?.student?.roll_no}
      </Text>

      <Text
        style={{
          marginTop: 15,
          textAlign: "center"
        }}
      >
        Gate Guard has approved your vacation request.
      </Text>

      <View style={styles.btnRow}>
<TouchableOpacity
  style={styles.confirmBtn}
  onPress={async () => {

    setGateApproved(false);

    await saveApprovedVacationExit();

  }}
>
  <Text style={styles.btnText}>
    Confirm Exit
  </Text>
</TouchableOpacity>

        <TouchableOpacity
          style={styles.cancelBtn}
          onPress={() => {
            setGateApproved(false);
          }}
        >
          <Text style={styles.btnText}>
            Cancel
          </Text>
        </TouchableOpacity>

      </View>

    </View>
  </View>
</Modal>

</View>




  );
}

const styles = StyleSheet.create({
  scanBtn: { backgroundColor: "#0a3d62", padding: 15, alignItems: "center" },
  scanText: { color: "#fff", fontWeight: "bold" },

startContainer:{
    flexGrow:1,
    alignItems:"center",

    paddingHorizontal:25,

    paddingTop:20,

    paddingBottom:40,

    backgroundColor:"#f4f8fc",
},

  checkCircle:{
    width:90,
    height:90,
    borderRadius:45,
    backgroundColor:"#22c55e",
    justifyContent:"center",
    alignItems:"center",
    elevation:8,
},



  startBtn: {
    backgroundColor: "#0a3d62",
    padding: 15,
    borderRadius: 10,
      width:"100%",
      justifyContent:"center",
    alignItems:"center",
       elevation:8,
         height:50,
  },

  stopBtn: {
    backgroundColor: "#e74c3c",
    padding: 10,
    alignItems: "center",
  },

  topBar:{
    height:8,
    backgroundColor:"#22c55e",
    borderTopLeftRadius:25,
    borderTopRightRadius:25,
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


  insideStatus: {
  color: "#16a34a",
},

outsideStatus: {
  color: "#dc2626",
},

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



  successCard:{
    width:"90%",
    backgroundColor:"#fff",
    borderRadius:25,
    padding:28,

    shadowColor:"#000",
    shadowOffset:{
        width:0,
        height:8,
    },
    shadowOpacity:0.25,
    shadowRadius:12,

    elevation:15,
},

checkIcon: {
  fontSize: 55,
  color: "#16a34a",
  fontWeight: "bold",
},

successHeading: {
  fontSize: 24,
  fontWeight: "bold",
  color: "#16a34a",
  marginTop: 10,
},

welcome: {
  marginTop: 18,
  fontSize: 18,
  color: "#666",
  fontWeight: "600",
},

studentName:{
    fontSize:32,
    fontWeight:"900",
    color:"#0f172a",
    letterSpacing:1,
},

rollNumber: {
  fontSize: 17,
  color: "#777",
  marginTop: 5,
},

divider: {
  width: "100%",
  height: 1,
  backgroundColor: "#fbfbfb",
  marginVertical: 20,
},

infoRow:{
    flexDirection:"row",
    alignItems:"center",

    paddingVertical:14,
    paddingHorizontal:18,

    backgroundColor:"#f8fafc",

    borderRadius:12,

    marginBottom:12,
},

infoLabel:{
    width:110,          // fixed width
    fontSize:17,
    fontWeight:"700",
    color:"#333",
},

infoValue:{
    flex:1,
    textAlign:"right",
    fontSize:16,
    color:"#111",
},

statusBadge: {
  fontSize: 16,
  fontWeight: "bold",
  color: "#16a34a",
},

doneButton:{
    width:"100%",
    height:56,

    backgroundColor:"#0a3d62",

    borderRadius:14,

    justifyContent:"center",
    alignItems:"center",

    marginTop:15,

    elevation:8,
},
doneText: {
  color: "#fff",
  fontSize: 18,
  fontWeight: "bold",
},



heroTitle:{
    marginTop:10,

    fontSize:38,

    fontWeight:"900",

    color:"#0A3D62",

    textAlign:"center",
},

heroSubtitle:{
    marginTop:8,

    fontSize:21,

    textAlign:"center",

    fontWeight:"700",

    color:"#1E293B",
},

heroDescription:{
    marginTop:8,
    color:"#666",
    textAlign:"center",
    paddingHorizontal:40,
    lineHeight:22,
},

featureContainer:{
    width:"92%",

    marginTop:28,
},

featureCard:{
    flexDirection:"row",

    alignItems:"center",

    backgroundColor:"#fff",

    paddingVertical:18,

    paddingHorizontal:22,

    borderRadius:18,

    marginBottom:16,

    elevation:6,

    shadowColor:"#000",

    shadowOpacity:0.08,

    shadowOffset:{
        width:0,
        height:4,
    },

    shadowRadius:8,
},

featureIcon:{
    fontSize:26,
    marginRight:15,
},

featureText:{
    fontSize:16,
    fontWeight:"600",
    color:"#333",
},

footer:{
    marginTop:20,
    color:"#999",
    fontSize:10,
},

scanContainer: {
  width: 230,
  height: 230,

  borderRadius: 22,

  overflow: "hidden",

  borderWidth: 2,
  borderColor: "#12D8FF",

  backgroundColor: "#071A2F",

  justifyContent: "center",
  alignItems: "center",

  shadowColor: "#00CFFF",
  shadowOpacity: 0.35,
  shadowRadius: 12,
  shadowOffset: {
    width: 0,
    height: 5,
  },
  elevation: 10,

},


heroImage: {
  width: "100%",
  height: "100%",

  resizeMode: "cover",

  borderRadius: 22,
},

scanLine: {
  position: "absolute",

  width: "95%",

  height: 4,

  borderRadius: 20,

  backgroundColor: "#00E5FF",

  shadowColor: "#00E5FF",
  shadowOpacity: 1,
  shadowRadius: 12,

  elevation: 10,
},

scanGlow:{
    position:"absolute",

    width:"94%",

    height:18,

    borderRadius:30,

    backgroundColor:"rgba(0,245,255,0.22)",
},

scanGlowLarge:{
    position:"absolute",

    width:"200%",

    height:20,

    backgroundColor:"rgba(0,245,255,0.08)",
},

studentPhoto:{
    width:90,
    height:90,

    borderRadius:45,

    borderWidth:3,
    borderColor:"#16a34a",

    marginBottom:20,

    backgroundColor:"#eee",
},
captureContainer: {
  alignItems: "center",
  justifyContent: "center",
  paddingVertical: 8,
  backgroundColor: "#071A2F",
},

scanHint: {
  color: "#E2E8F0",
  fontSize: 15,
  fontWeight: "600",
  marginBottom: 8,
},

captureOuter: {
  width: 62,
  height: 62,
  borderRadius: 31,

  borderWidth: 3,
  borderColor: "#FFFFFF",

  justifyContent: "center",
  alignItems: "center",

  backgroundColor: "rgba(255,255,255,0.08)",

  shadowColor: "#FFFFFF",
  shadowOpacity: 0.25,
  shadowRadius: 8,
  shadowOffset: {
    width: 0,
    height: 3,
  },
  elevation: 6,
},

captureInner: {
  width: 46,
  height: 46,
  borderRadius: 23,

  backgroundColor: "#FFFFFF",
},

captureScanning: {
  backgroundColor: "#22C55E",
},
});