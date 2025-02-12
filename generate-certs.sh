#!/bin/sh

# exit when any command fails
set -e

# current and script working directory
SWD=$(realpath "$(dirname "${0}")")

# Create certs directory if it doesn't exist
mkdir -p "${SWD}/certs"

# Generate CA key and certificate with predefined subject
openssl genrsa -out "${SWD}/certs/ca_key.pem" 2048
openssl req -new -x509 -key "${SWD}/certs/ca_key.pem" -out "${SWD}/certs/ca_cert.pem" -days 365 -subj "/C=US/ST=CA/L=San Francisco/O=Hummingbot/OU=Development/CN=localhost/emailAddress=dev@hummingbot.io"

# Generate server private key
openssl genrsa -out "${SWD}/certs/server_key.pem" 2048

# Generate CSR with predefined subject
openssl req -new -key "${SWD}/certs/server_key.pem" -out "${SWD}/certs/server.csr" -subj "/C=US/ST=CA/L=San Francisco/O=Hummingbot/OU=Development/CN=localhost/emailAddress=dev@hummingbot.io"

# Sign the certificate with our CA
openssl x509 -req -days 365 -in "${SWD}/certs/server.csr" -CA "${SWD}/certs/ca_cert.pem" -CAkey "${SWD}/certs/ca_key.pem" -CAcreateserial -out "${SWD}/certs/server_cert.pem"

# Clean up intermediate files
rm "${SWD}/certs/server.csr" "${SWD}/certs/ca_key.pem" "${SWD}/certs/ca_cert.srl"

# Set appropriate permissions
chmod 600 "${SWD}/certs/"*.pem
