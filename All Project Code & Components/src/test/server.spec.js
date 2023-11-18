// Imports the index.js file to be tested.
const server = require('../index'); //TO-DO Make sure the path to your index.js is correctly added
// Importing libraries

// Chai HTTP provides an interface for live integration testing of the API's.
const chai = require('chai');
const chaiHttp = require('chai-http');
chai.should();
chai.use(chaiHttp);
const { assert, expect } = chai;

describe('Register!', () => {
    // Sample test case given to test / endpoint.
    it("Register test user", done => {
        chai
            .request(server)
            .post('/register')
            .send({
                username: 'test',
                email: 'test@gmail.com',
                password1: 'test',
                password2: 'test'
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
                password: 'test',
            })
            .end((err, res) => {
                res.should.have.status(200); // checks for redirect to home page ('/')
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

    it('should delete a user and return a success message', (done) => {
        chai.request(server)
            .delete('/delete/test')
            .end((err, res) => {
                res.should.have.status(200);
                res.body.should.be.a('object');
                res.body.should.have.property('message').eql('User deleted successfully');
                done();
            });
    });
});