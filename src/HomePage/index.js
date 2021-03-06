import React, { Component } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  TouchableWithoutFeedback,
  Keyboard
} from 'react-native';
import SQLite from 'react-native-sqlite-storage';
import loremIpsum from 'lorem-ipsum-react-native';
import uuid from 'uuid/v4';

SQLite.enablePromise(true);

const DEFAULT_MESSAGE_COUNT = 200;
const TEXT_MESSAGE_PERCENTAGE = 70;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5FCFF',
  },
  welcome: {
    fontSize: 20,
    textAlign: 'center',
    margin: 10,
  },
  instructions: {
    textAlign: 'center',
    color: '#333333',
    marginBottom: 5,
  },
  populateDBButton: {
    height: 50,
    width: 200,
    marginTop: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9c99f',
    flexDirection: 'row',
  },
  openChatButton: {
    height: 50,
    width: 120,
    marginTop: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#c6a0ff'
  },
  populatingLoaderContainer: {
    marginLeft: 10
  },
  messageCountContainer: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  messageCountInput: {
    marginLeft: 10,
    width: 60,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#E5E9F2',
  },
});

export default class HomePage extends Component {
  static navigationOptions = {
    header: null,
    headerBackTitle: 'Home'
  };

  state = {
    isPopulating: false
  };

  async componentDidMount() {
    try {
      window.db = await SQLite.openDatabase({ name: 'test.db' });
      // await window.db.executeSql('DROP TABLE IF EXISTS chat;');
      await window.db.executeSql(`
        CREATE TABLE IF NOT EXISTS chat (
          id TEXT,
          messageType TEXT,
          messageText TEXT,
          messageImage TEXT,
          senderName TEXT,
          senderPicture TEXT,
          senderId TEXT,
          messageDate INTEGER,
          PRIMARY KEY(id)
        )
      `);
      const numChatsResult = await window.db.executeSql('select count(*) as numChats from chat;');
      const numChats = numChatsResult[0].rows.item(0).numChats;
      if (numChats === 0) {
        this.populateDatabase(DEFAULT_MESSAGE_COUNT);
      }
    } catch (error) {
      console.log('Error is', error);
    }
  }

  onMessageCountChange = text => (this.messageCountValue = text);

  getRandomNumber = (min, max) => Math.floor(Math.random() * (max - min)) + min

  messageCountValue = DEFAULT_MESSAGE_COUNT;

  openChatScreen = () => {
    const { navigate } = this.props.navigation;
    navigate('Chats');
  }

  repopulateDatabase = () => {
    if (this.state.isPopulating) {
      return;
    }

    const numMessages = parseInt(this.messageCountValue);
    this.populateDatabase(numMessages);
  }

  populateDatabase = async (numMessages) => {
    try {
      const numUsers = Math.ceil(numMessages / 4);
      this.setState({ isPopulating: true });
      console.log('starting populatedb');
      await window.db.executeSql('delete from chat;');

      const response = await fetch(`https://randomuser.me/api/?results=${numUsers}&inc=name,picture`);
      if (response.status < 200 || response.status >= 300) {
        throw new Error('Got repsonse with status code: ' + response.status);
      }
      setTimeout(() => null, 0); // workaround for #issue-6679
      const responseObject = await response.json();
      const randomUsers = responseObject.results;

      console.log('got random users');

      const unsplashResponse = await fetch('https://unsplash.it/list');
      if (response.status < 200 || response.status >= 300) {
        throw new Error('Got repsonse with status code: ' + response.status + ' for unsplash images');
      }
      setTimeout(() => null, 0); // workaround for #issue-6679
      const unsplashResponseJSON = await unsplashResponse.json();
      const unsplashImageIds = unsplashResponseJSON.map(item => item.id);
      const totalUnsplashImages = unsplashImageIds.length;

      console.log('got random images list');

      const maxDate = new Date().getTime();
      const monthMillis = 30 * 24 * 60 * 60 * 1000;
      const minDate = maxDate - monthMillis;

      const messages = [];
      let index = 0;

      // Insert text messages
      const numTextMessages = numMessages * (TEXT_MESSAGE_PERCENTAGE / 100);
      for (; index < numTextMessages; index += 1) {
        const randomUser = randomUsers[this.getRandomNumber(0, numUsers)];
        const id = uuid();
        const senderId = randomUser.id || uuid();
        randomUser.id = senderId;
        const senderName = `${randomUser.name.first} ${randomUser.name.last}`;
        const senderPicture = randomUser.picture.medium;
        const numberOfWords = this.getRandomNumber(10, 100);
        const messageText = loremIpsum({ count: numberOfWords, units: 'words' });
        const messageDate = this.getRandomNumber(minDate, maxDate);

        messages.push(
          JSON.stringify(
            [id, 'text', messageText, '', senderName, senderPicture, senderId, messageDate]
          ).slice(1, -1)
        );
      }

      // Insert image messages
      for (; index < numMessages; index += 1) {
        const randomUser = randomUsers[this.getRandomNumber(0, numUsers)];
        const id = uuid();
        const senderId = randomUser.id || uuid();
        randomUser.id = senderId;
        const senderName = `${randomUser.name.first} ${randomUser.name.last}`;
        const senderPicture = randomUser.picture.medium;
        const randomImageNumber = this.getRandomNumber(0, totalUnsplashImages);
        const imageId = unsplashImageIds[randomImageNumber];
        const messageImage = `https://unsplash.it/400/300?image=${imageId}`;
        const messageDate = this.getRandomNumber(minDate, maxDate);

        messages.push(
          JSON.stringify(
            [id, 'image', '', messageImage, senderName, senderPicture, senderId, messageDate]
          ).slice(1, -1)
        );
      }

      const messageValues = `(${messages.join('), (')})`;

      // Write messages to db
      await window.db.executeSql(`
        insert into chat (
          id,
          messageType,
          messageText,
          messageImage,
          senderName,
          senderPicture,
          senderId,
          messageDate
        ) values ${messageValues}
      `);

      console.log('chats added successfully');
    } catch (error) {
      console.log('Error in populatedb', error);
    }
    this.setState({ isPopulating: false });
  }

  renderPopulatingLoader = () => {
    if (!this.state.isPopulating) {
      return null;
    }

    return (
      <View style={styles.populatingLoaderContainer}>
        <ActivityIndicator />
      </View>
    );
  }

  render() {
    return (
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.container}>
          <Text style={styles.welcome}>
            Welcome to React Native!
          </Text>
          <Text style={styles.instructions}>
            To get started, edit src/index.js
          </Text>
          <Text style={styles.instructions}>
            Press Cmd+R to reload,{'\n'}
            Cmd+D or shake for dev menu
          </Text>
          <View style={styles.messageCountContainer}>
            <Text>Number of messages</Text>
            <TextInput
              onChangeText={this.onMessageCountChange}
              defaultValue={DEFAULT_MESSAGE_COUNT.toString()}
              style={styles.messageCountInput}
              keyboardType={'numeric'}
              maxLength={4}
              underlineColorAndroid={'rgba(0, 0, 0, 0)'}
            />
          </View>
          <TouchableOpacity style={styles.populateDBButton} onPress={this.repopulateDatabase}>
            <Text>Repopulat{this.state.isPopulating ? 'ing' : 'e'} Database</Text>
            {this.renderPopulatingLoader()}
          </TouchableOpacity>
          <TouchableOpacity style={styles.openChatButton} onPress={this.openChatScreen}>
            <Text>Open Chats</Text>
          </TouchableOpacity>
        </View>
      </TouchableWithoutFeedback>
    );
  }
}
