// Word pools for made-up student papers. Every person, school, street and number here is invented; first and last names are mixed at random, so no paper describes a real student.
'use strict';

// Given names from many places, spelled the way students write them in English.
const FIRST = ('Aaliyah Abdul Ada Adebayo Aditi Ahmed Aiko Aisha Alejandro Alexei Amara Amira Ananya Anh Arjun Aryan Astrid Ayaan Bao Beatriz Bilal Camila Chidi Chloe Daniela Darius Dmitri Elif Elena Emeka Esperanza Farah Fatima Felipe Freya Gabriel Hana Hamza Haruto Hiroshi Ibrahim Ifeoma Imani Ines Isabela Ivan Jae Javier Jia Jin Joaquin Kai Kamal Karim Katarina Kavya Kenji Khalid Kofi Lars Layla Leila Linh Lucia Luis Malak Mariam Mateo Mei Mehmet Mia Minh Mohammed Nadia Naledi Nasser Nguyen Nikolai Noor Olu Omar Oscar Pablo Parisa Priya Quan Rahul Rania Ravi Reza Rin Rohan Rosa Sahil Salma Santiago Sanjay Saoirse Sergei Shira Siddharth Siobhan Soo Sora Suki Tariq Thandiwe Tomas Tuan Valentina Vikram Wei Xin Yara Yasmin Yohannes Yuki Yusuf Zainab Zara Zeynep Zhi Zoltan ' +
  'Aiden Ben Caleb Dylan Emma Ethan Hannah Isaac Jack Liam Lucas Maya Noah Olivia Owen Ryan Sam Sophie Tyler Zoe').split(' ');
// Given names that are also everyday words: the hardest case.
const FIRST_WORD = 'Will Grace Hope Joy May Faith Rose Ruby June Summer Mark Bill Frank Hunter Sky River Dawn Autumn Ivy Jade'.split(' ');
const LAST = ('Abara Acheampong Adeyemi Aguilar Ahn Akhtar Al-Farsi Alvarez Andersen Aoki Arslan Asante Bakr Banerjee Bello Bhatt Bui Castillo Chaudhry Chowdhury Cruz Dang Demir Diallo Dimitrov Do Duarte Eze Farouk Fernandes Goh Gonzaga Guerrero Haddad Hashemi Hosseini Huynh Ibekwe Ishikawa Iyer Jovanovic Kader Kapoor Karimi Kaur Khoury Kim Kowalski Kuznetsov Lam Lindqvist Lopes Mahmoud Malik Mansour Medina Mendoza Mensah Molina Morales Mukherjee Nakamura Nasser Ng Nwosu Obi Okafor Okonkwo Oyelaran Ozturk Pak Petrov Pham Qureshi Rahman Ramos Rashid Reyes Rojas Saito Salazar Sandoval Sato Shah Sharma Siddiqui Silva Sokolov Suarez Suleiman Takahashi Tan Tanaka Thapa Tiwari Toure Tran Trivedi Uchenna Valdez Vargas Volkov Vu Wanjiru Watanabe Yamamoto Yilmaz Yoon Zhang Zhou ' +
  'Bennett Carter Coleman Fischer Fletcher Gallagher Hughes Jensen Keller Murphy Novak Porter Russo Sullivan Walsh').split(' ');
const LAST_WORD = 'Hall King Young Brown Green White Wood Stone Little Price Long Park Lee Mills Fox Bird Rich'.split(' ');
// Names in other alphabets, for the few papers that have them.
const OTHER = ['李明轩', '王雨桐', '김지우', '박서연', 'محمد العلي', 'فاطمة حداد', 'Андрей Волков', 'Мария Петрова', 'สมชาย ใจดี', 'นภา ศรีสุข', 'Nguyễn Thị Mai', 'Trần Văn Đức', 'שירה כהן', 'प्रिया शर्मा', '佐藤 陽菜'];

const NICK = { Alejandro: 'Ale', Alexei: 'Lyosha', Dmitri: 'Dima', Katarina: 'Kat', Mohammed: 'Mo', Nikolai: 'Kolya', Santiago: 'Santi', Siddharth: 'Sid', Valentina: 'Vale', Gabriel: 'Gabe', Isabela: 'Bela', Mateo: 'Teo', Ibrahim: 'Ibby', Hamza: 'Hamz', Ananya: 'Anu', Vikram: 'Vik', Zainab: 'Zee', Olivia: 'Liv', Samuel: 'Sammy', Benjamin: 'Benji', Daniela: 'Dani', Javier: 'Javi', Sergei: 'Seryozha', Joaquin: 'Quino', Aaliyah: 'Lia', Khalid: 'Kal', Priya: 'Pri', Rohan: 'Ro' };

const RELATIVE = ['mom', 'mum', 'dad', 'mother', 'father', 'brother', 'sister', 'little brother', 'older sister', 'cousin', 'uncle', 'aunt', 'grandma', 'grandpa', 'grandmother', 'best friend', 'friend', 'neighbor', 'stepdad', 'stepmom'];
const TEACHER_TITLE = ['Mr.', 'Ms.', 'Mrs.', 'Dr.', 'Miss', 'Coach'];
const SCHOOL = ['Riverbend International School', 'Northgate Academy', 'Lakeview High School', 'Cedar Hill Secondary', 'Westmoor College', 'St. Aldric School', 'Harbor Point International', 'Maplewood High', 'Kestrel Bay Academy', 'Sunridge Middle School'];
const SCHOOL_SHORT = ['Riverbend', 'Northgate', 'Lakeview', 'Cedar Hill', 'Westmoor', 'Harbor Point', 'Maplewood', 'Kestrel Bay'];
const TOWN = ['Ashford Vale', 'Brookhaven', 'Corran', 'Dunmore', 'Elmstead', 'Fairhollow', 'Glenarby', 'Holloway Springs', 'Kirkwell', 'Lowtide', 'Marrow Creek', 'Pellston', 'Quarrington', 'Redfern Bay', 'Thistlewood'];
const STREET = ['Larchmont', 'Willowbrook', 'Chestnut', 'Kingsley', 'Ferncliff', 'Ashgrove', 'Orchard', 'Hawthorne', 'Bramble', 'Juniper'];
const STREET_KIND = ['Road', 'Street', 'Lane', 'Avenue', 'Drive', 'Close', 'Rd', 'St'];
const TEAM = ['Falcons', 'Riverbend Otters', 'Comets', 'Northgate Hawks'];
const HOUSE = ['Phoenix House', 'Kestrel House', 'Orion House', 'Aurora House'];

// People and places a student may write about that identify no one: these should stay as typed.
const PUBLIC = ['Shakespeare', 'Harper Lee', 'Atticus Finch', 'Scout', 'Jay Gatsby', 'Daisy Buchanan', 'Romeo', 'Juliet', 'Macbeth', 'Lady Macbeth', 'George Orwell', 'Winston Smith', 'Martin Luther King Jr.', 'Marie Curie', 'Albert Einstein', 'Isaac Newton', 'Charles Darwin', 'Gandhi', 'Napoleon', 'Abraham Lincoln', 'Malala Yousafzai', 'Nelson Mandela', 'Frida Kahlo', 'Chinua Achebe', 'Okonkwo', 'Toni Morrison', 'Jane Austen', 'Elizabeth Bennet', 'Mr. Darcy', 'Holden Caulfield', 'Piggy', 'Ralph', 'Jack', 'Steinbeck', 'Lennie', 'George'];
const PUBLIC_PLACE = ['Paris', 'London', 'Tokyo', 'Nigeria', 'India', 'Brazil', 'Egypt', 'the Amazon', 'Europe', 'Asia', 'Africa', 'New York', 'Mexico', 'China', 'Korea', 'Vietnam', 'Thailand', 'the Pacific Ocean', 'Mars', 'Maycomb', 'West Egg'];
const BOOK = ['To Kill a Mockingbird', 'The Great Gatsby', 'Animal Farm', 'Nineteen Eighty-Four', 'Things Fall Apart', 'Of Mice and Men', 'Lord of the Flies', 'Pride and Prejudice', 'Romeo and Juliet', 'Macbeth', 'The Crucible'];
const TOPIC = ['climate change', 'social media', 'photosynthesis', 'the French Revolution', 'renewable energy', 'friendship', 'identity', 'power', 'courage', 'injustice', 'migration', 'the water cycle', 'artificial intelligence', 'plastic pollution', 'the Cold War'];

module.exports = { FIRST, FIRST_WORD, LAST, LAST_WORD, OTHER, NICK, RELATIVE, TEACHER_TITLE, SCHOOL, SCHOOL_SHORT, TOWN, STREET, STREET_KIND, TEAM, HOUSE, PUBLIC, PUBLIC_PLACE, BOOK, TOPIC };
