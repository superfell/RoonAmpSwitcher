#include <ESP8266WiFi.h>
#include <ESP8266mDNS.h>

//////////////////////
// WiFi Definitions //
//////////////////////
const char WiFiName[] = "<WifiName>";
const char WiFiPwd[] = "<WifiPassword>";

/////////////////////
// Pin Definitions //
/////////////////////
const int LED_PIN = 5; // Thing's onboard green LED
const int RELAY_PIN = 4; // Thing's pin that triggers the relay

WiFiServer server(9090);

void setup() {
  // put your setup code here, to run once:
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  pinMode(RELAY_PIN, OUTPUT);
  setupWiFi();
  server.begin();
  setupMDNS();
}

void loop() {
  // put your main code here, to run repeatedly:
  // Check if a client has connected
  WiFiClient client = server.available();
  if (!client) {
    return;
  }
  while (client.available() < 4) {
    delay(5);
  }
  uint8_t buff[4];
  int x = client.read(buff, 4);
  Serial.printf("read %d bytes %c %c %c %c\n",x, buff[0], buff[1], buff[2], buff[3]);
  if (buff[0] == 'S' && buff[1] == 'T' && buff[2] == 'A' && buff[3] == 'T') {
      int state = digitalRead(RELAY_PIN);
      client.print(state == HIGH ?"ON  \n": "OFF \n");

  } else if (buff[0] == 'U' && buff[1] == 'O' && buff[2] == 'N') {
      digitalWrite(RELAY_PIN, HIGH);
      delay(1000);
      client.print("ON  \n");

  } else if (buff[0] == 'U' && buff[1] == 'O' && buff[2] == 'F' && buff[3] == 'F') {
      digitalWrite(RELAY_PIN, LOW);
      delay(1000);
      client.print("OFF \n");
  }
  client.flush();
  client.stop();
}

void setupWiFi()
{
  WiFi.hostname("amp_esp8266");
  WiFi.mode(WIFI_STA);
  WiFi.begin(WiFiName, WiFiPwd);
  Serial.println("Connecting");
  bool led = HIGH;
  int count = 0;
  while (WiFi.status() != WL_CONNECTED)
  {
    digitalWrite(LED_PIN, led);
    delay(120);
    Serial.print(".");
    led = !led;
    count++;
    if (count % 10 == 0) {
      Serial.printf("wifi status: %d\n", WiFi.status());
    }
    if (count % 100 == 0) {
      WiFi.printDiag(Serial);
    }
  }
  Serial.println();

  Serial.print("Connected, IP address: ");
  Serial.println(WiFi.localIP());
  digitalWrite(LED_PIN, LOW);
}

void setupMDNS()
{
  // Call MDNS.begin(<domain>) to set up mDNS to point to
  // "<domain>.local"
  if (!MDNS.begin("amp"))
  {
    Serial.println("Error setting up MDNS responder!");
    while (1) {
      delay(1000);
    }
  }
  Serial.println("mDNS responder started");

}

