param(
 [Parameter(Mandatory=$true)][string]$Auth0Cli,
 [Parameter(Mandatory=$true)][string]$Domain,
 [Parameter(Mandatory=$true)][string]$SpaClientId,
 [Parameter(Mandatory=$true)][string]$SiteUrl,
 [string]$StaticApp='usfolio-web-app',
 [string]$ResourceGroup='usfolio-rg'
)
$ErrorActionPreference='Stop'
function Invoke-Auth0([string]$Method,[string]$Path,$Body=$null) {
 $scratch=$null
 try {
  if($null -ne $Body){
   $scratch=[IO.Path]::GetTempFileName()
   [IO.File]::WriteAllText($scratch,(ConvertTo-Json -InputObject $Body -Depth 20 -Compress))
   $raw = & $Auth0Cli api $Method $Path --data "@$scratch"
  } else { $raw = & $Auth0Cli api $Method $Path }
  if($LASTEXITCODE -ne 0){throw "Auth0 operation failed: $Method $Path"}
  if($raw){return ($raw | ConvertFrom-Json)}
 } finally {if($scratch){Remove-Item -LiteralPath $scratch -ErrorAction SilentlyContinue}}
}
$spa=Invoke-Auth0 patch "clients/$SpaClientId" @{
 name='Usfolio'; app_type='spa'; is_first_party=$true;
 token_endpoint_auth_method='none'; grant_types=@('authorization_code');
 callbacks=@($SiteUrl,'http://localhost:5173');
 allowed_logout_urls=@($SiteUrl,'http://localhost:5173');
 web_origins=@($SiteUrl,'http://localhost:5173');
 jwt_configuration=@{alg='RS256'}
}
Write-Output 'Configured Usfolio SPA with exact production and localhost callbacks.'
$apis=Invoke-Auth0 get 'resource-servers'
$api=$apis | Where-Object {$_.identifier -eq 'https://usfolio-api'}
if(-not $api){
 $api=Invoke-Auth0 post 'resource-servers' @{
  name='Usfolio API'; identifier='https://usfolio-api'; signing_alg='RS256';
  token_lifetime=900; token_lifetime_for_web=900; allow_offline_access=$false;
  skip_consent_for_verifiable_first_party_clients=$true
 }
}
$connections=Invoke-Auth0 get 'connections'
foreach($connection in $connections){
 # Only change this application's connection membership; preserve all other apps.
 $enabled=$connection.strategy -eq 'auth0'
 if($enabled -or $connection.strategy -eq 'google-oauth2'){
  $null=Invoke-Auth0 patch "connections/$($connection.id)/clients" @(@{client_id=$SpaClientId;status=$enabled})
 }
}
Write-Output 'Enabled email/password login for Usfolio.'
$clients=Invoke-Auth0 get 'clients'
$management=$clients | Where-Object {$_.name -eq 'Usfolio account deletion'}
if(-not $management){
 $management=Invoke-Auth0 post 'clients' @{
  name='Usfolio account deletion'; app_type='non_interactive';
  is_first_party=$true; grant_types=@('client_credentials');
  token_endpoint_auth_method='client_secret_post'
 }
} else { $management=Invoke-Auth0 get "clients/$($management.client_id)" }
$grants=Invoke-Auth0 get 'client-grants'
if(-not ($grants | Where-Object {$_.client_id -eq $management.client_id -and $_.audience -eq "https://$Domain/api/v2/"})){
 $null=Invoke-Auth0 post 'client-grants' @{
  client_id=$management.client_id; audience="https://$Domain/api/v2/"; scope=@('delete:users')
 }
}
if(-not $management.client_secret){throw 'Management application secret was not returned; settings were not changed.'}
# Pass secrets directly to Azure; never print them or write them into the repository.
& az staticwebapp appsettings set --name $StaticApp --resource-group $ResourceGroup --setting-names "AUTH0_DOMAIN=$Domain" 'AUTH0_AUDIENCE=https://usfolio-api' "AUTH0_MANAGEMENT_CLIENT_ID=$($management.client_id)" "AUTH0_MANAGEMENT_CLIENT_SECRET=$($management.client_secret)" --output none
if($LASTEXITCODE){throw 'Azure Auth0 setting update failed.'}
Write-Output 'Stored Auth0 API configuration in Azure; deletion grant is limited to delete:users.'
[PSCustomObject]@{Domain=$Domain;SpaClientId=$SpaClientId;Audience='https://usfolio-api';Site=$SiteUrl} | ConvertTo-Json
