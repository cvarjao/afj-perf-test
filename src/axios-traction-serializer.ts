import { InternalAxiosRequestConfig } from "axios"
import { dir as console_dir } from "console"

export const cache_requests = (requests: unknown[] = []) =>{
    return (request: InternalAxiosRequestConfig<any>) => {
      //take a copy
      const req = JSON.parse(JSON.stringify({
        headers:request.headers,
        data:request.data,
        params:request.params,
        baseUrl: '--redacted--', //request.baseURL,
        method: request.method,
        url: request.url
      }))
      if (req.headers['Authorization']) {
        req.headers['Authorization'] = '--redacted--'
      }
      if (req.url.startsWith('/connections/')){
        const regex = /^(\/connections\/)([^/]+)(\/[^/]+)?$/mg;
        req.url = req.url.replace(regex, '$1{connection_id}$3');
      }
      if (req.url.startsWith('/issue-credential/records/')){
        const regex = /^(\/issue-credential\/records\/)([^/]+)(\/[^/]+)?$/mg;
        req.url = req.url.replace(regex, '$1{record_id}$3');
      }
      if (req.url.startsWith('/present-proof/records/')){
        const regex = /^(\/present-proof\/records\/)([^/]+)(\/[^/]+)?$/mg;
        req.url = req.url.replace(regex, '$1{record_id}$3');
      }
      if (req.url.startsWith('/present-proof-2.0/records/')){
        const regex = /^(\/present-proof-2.0\/records\/)([^/]+)(\/[^/]+)?$/mg;
        req.url = req.url.replace(regex, '$1{record_id}$3');
      }
      if (req.url.startsWith('/credential-definitions/')){
        if (!(req.url === '/credential-definitions/created')){
          const regex = /^(\/credential-definitions\/)([^/]+)(\/[^/]+)?$/mg;
          req.url = req.url.replace(regex, '$1{cred_def_id}$3');
        }
      }
      if (req.method === 'get' && req.url === '/basicmessages' && req.params?.connection_id) {
        req.params.connection_id = '{connection_id}'
      }
      if (req.method === 'post' && req.url === '/present-proof/send-request' && req.data) {
        req.data.proof_request = '--redacted--'
        req.data.connection_id = '{connection_id}'
        req.data.cred_def_id = '{cred_def_id}'
      }
      if (req.method === 'post' && req.url === '/issue-credential/send-offer' && req.data) {
        req.data.credential_preview = '{--redacted--}'
        req.data.cred_def_id = '{cred_def_id}'
        req.data.connection_id = '{connection_id}'
      }
      if (req.method === 'post' && req.url === '/present-proof/create-request' && req.data) {
        req.data.proof_request = '{--redacted--}'
      }
      if (req.method === 'post' && req.url === '/out-of-band/create-invitation' && req.data?.attachments) {
        //req.data.attachments = '--redacted--'
        for (const attachment of req.data.attachments) {
          if (attachment?.id){
            attachment.id = '--redacted--'
          }
          if (attachment.data?.json){
            if (attachment?.data?.id){
              attachment.data.id = '--redacted--'
            }
            if (attachment?.data?.json?.id){
              attachment.data.json.id = '--redacted--'
            }
            if (attachment.data?.json?.thread_id) {
              attachment.data.json.thread_id = '--redacted--'
            }
            if (attachment.data?.json?.created_at){
              attachment.data.json.created_at = '--redacted--'
            }
            if (attachment.data?.json?.updated_at){
              attachment.data.json.updated_at = '--redacted--'
            }
            if (attachment.data?.json?.presentation_exchange_id) {
              attachment.data.json.presentation_exchange_id = '--redacted--'
            }
            if (attachment.data?.json?.pres_ex_id) {
              attachment.data.json.pres_ex_id = '--redacted--'
            }
            if (attachment.data?.json?.presentation_request) {
              attachment.data.json.presentation_request = '{--redacted--}'
            }
            if (attachment.data?.json?.presentation_request_dict) {
              attachment.data.json.presentation_request_dict = '{--redacted--}'
            }
            if (attachment.data?.json?.by_format?.pres_request?.indy) {
              attachment.data.json.by_format.pres_request.indy.nonce = '--redacted--'
              const requested_attributes = attachment.data?.json?.by_format.pres_request?.indy?.requested_attributes
              if (requested_attributes){
                for (const key in requested_attributes) {
                  if (Object.prototype.hasOwnProperty.call(requested_attributes, key)) {
                    const item = requested_attributes[key];
                    if (item.non_revoked?.from) {
                      item.non_revoked.from = '--redacted--'
                    }
                    if (item.non_revoked?.to) {
                      item.non_revoked.to = '--redacted--'
                    }
                    if (item.restrictions) {
                      for (const restriction of item.restrictions) {
                        if (restriction.issuer_did) {
                          restriction.issuer_did = '--redacted--'
                        }
                      }
                    }
                  }
                }
              }
            }
            if (attachment.data?.json?.pres_request) {
              attachment.data.json.pres_request = '{--redacted--}'
            }
          }
        }
      }
      if (req.method === 'post' && req.url === '/present-proof-2.0/create-request' && req.data) {
        req.data.presentation_request = '{--redacted--}'
      }
      if (req.method === 'post' && req.url === '/connections/{connection_id}' && req.data?.my_label) {
        const regex = /(- \d+$)/mg;
        req.data.my_label = req.data.my_label.replace(regex, '- {timestamp}');
      }
      // do not add consecutive duplicates
      if (requests.length > 0) {
        const prev = requests[requests.length - 1]
        if (JSON.stringify(prev) === JSON.stringify(req)) {
          //console_dir(request, {depth: 6})
          return request
        }
      }
      //console_dir(req, {depth: 6})
      requests.push(req)
      return request
    }
}