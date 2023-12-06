// Imports the index.js file to be tested.
const server = require('../index'); //TO-DO Make sure the path to your index.js is correctly added
// Importing libraries

// Chai HTTP provides an interface for live integration testing of the API's.
const chai = require('chai');
const chaiHttp = require('chai-http');
chai.should();
chai.use(chaiHttp);
const { assert, expect } = chai;

let cookie;

describe('Register!', () => {
    // Sample test case given to test / endpoint.
    it("Register test user", done => {
        chai
            .request(server)
            .post('/register')
            .send({
                displayName: 'test',
                username: 'test',
                email: 'test@gmail.com',
                password1: 'test1234',
                password2: 'test1234'
            })
            .redirects(0)
            .end((err, res) => {
                res.should.have.status(302); // checks for redirect to login page ('/login')
                done();
            });
    });
});

describe('Login!', () => {
    it("Redirect to '/' on correct login info", done => {
        chai
            .request(server)
            .post('/login')
            .send({
                username: 'test',
                password: 'test1234',
            })
            .end((err, res) => {
                res.should.have.status(200); // checks for redirect to home page ('/')
                cookie = res.headers['set-cookie'];
                done();
            });
    });

    it("Return 'incorrect username or password' when password is incorrect", done => {
        chai
            .request(server)
            .post('/login')
            .send({
                username: 'test',
                password: 'incorrect',
            })
            .end((err, res) => {
                res.text.should.include('Incorrect username or password.');
                done();
            });
    });

});
describe('Delete User!', () => {
    it('should delete a user', (done) => {
        chai.request(server)
            .post('/profile/delete')
            .set('Cookie', cookie) // Set the session cookie
            .end((err, res) => {
                res.text.should.include("Account Successfully Deleted");
                done();
            });
    });
});